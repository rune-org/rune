"""
Rune Workflow Scheduler

Polls PostgreSQL for due scheduled workflows and publishes them
to RabbitMQ for execution by the worker service.
"""

import asyncio
import base64
import copy
import json
import logging
import os
import signal
import sys
import uuid
from datetime import datetime, timedelta

import aio_pika
import asyncpg
from aio_pika import DeliveryMode, Message
from cryptography.fernet import Fernet

# ---------------------------------------------------------------------------
# Configuration (env vars with sensible defaults)
# ---------------------------------------------------------------------------

POSTGRES_DSN = (
    f"postgresql://{os.getenv('POSTGRES_USER', 'rune')}:{os.getenv('POSTGRES_PASSWORD', 'rune_password')}"
    f"@{os.getenv('POSTGRES_HOST', 'localhost')}:{os.getenv('POSTGRES_PORT', '5432')}"
    f"/{os.getenv('POSTGRES_DB', 'rune_db')}"
)
RABBITMQ_URL = (
    f"amqp://{os.getenv('RABBITMQ_USER', 'rune')}:{os.getenv('RABBITMQ_PASSWORD', 'rune_password')}"
    f"@{os.getenv('RABBITMQ_HOST', 'localhost')}:{os.getenv('RABBITMQ_PORT', '5672')}/"
)
RABBITMQ_QUEUE = os.getenv("RABBITMQ_QUEUE", "workflow.execution")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")
POLL_INTERVAL = int(os.getenv("SCHEDULER_POLL_INTERVAL", "30"))
LOOK_AHEAD = int(os.getenv("SCHEDULER_LOOK_AHEAD", "60"))

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("scheduler")

# ---------------------------------------------------------------------------
# Credential resolution
# ---------------------------------------------------------------------------

encryptor = Fernet(ENCRYPTION_KEY.encode()) if ENCRYPTION_KEY else None


async def resolve_credentials(workflow_data: dict, db: asyncpg.Connection) -> dict:
    """Decrypt and embed credential values into workflow nodes."""
    data = copy.deepcopy(workflow_data)

    for node in data.get("nodes", []):
        cred_ref = node.get("credentials")
        if not isinstance(cred_ref, dict) or "id" not in cred_ref:
            continue

        if not encryptor:
            raise RuntimeError("ENCRYPTION_KEY is required to resolve credentials")

        cred_id = int(cred_ref["id"])
        row = await db.fetchrow(
            "SELECT id, name, credential_type, credential_data FROM workflow_credentials WHERE id = $1",
            cred_id,
        )
        if not row:
            raise ValueError(f"Credential {cred_id} not found")

        encrypted = row["credential_data"]
        if isinstance(encrypted, str):
            encrypted = encrypted.encode()

        decrypted = encryptor.decrypt(base64.b64decode(encrypted))
        values = json.loads(decrypted.decode())

        node["credentials"] = {
            "id": str(row["id"]),
            "name": row["name"],
            "type": row["credential_type"],
            "values": values,
        }

    return data


# ---------------------------------------------------------------------------
# Message publishing (matches API's WorkflowQueueService format)
# ---------------------------------------------------------------------------


async def publish_workflow(channel, workflow_id: int, workflow_data: dict) -> str:
    """Build and publish a workflow execution message. Returns execution_id."""
    nodes = workflow_data.get("nodes", [])
    edges = workflow_data.get("edges", [])

    trigger_nodes = [n for n in nodes if n.get("trigger")]
    if len(trigger_nodes) != 1:
        raise ValueError(f"Expected 1 trigger node, found {len(trigger_nodes)}")

    trigger_id = trigger_nodes[0]["id"]
    first_nodes = [e["dst"] for e in edges if e.get("src") == trigger_id]
    if not first_nodes:
        raise ValueError("No nodes connected after trigger")

    execution_id = str(uuid.uuid4())
    payload = {
        "workflow_id": str(workflow_id),
        "execution_id": execution_id,
        "current_node": first_nodes[0],
        "workflow_definition": workflow_data,
        "accumulated_context": {},
    }

    await channel.default_exchange.publish(
        Message(
            body=json.dumps(payload).encode(),
            delivery_mode=DeliveryMode.PERSISTENT,
            content_type="application/json",
        ),
        routing_key=RABBITMQ_QUEUE,
    )
    return execution_id


# ---------------------------------------------------------------------------
# Core polling loop
# ---------------------------------------------------------------------------

FETCH_DUE_SCHEDULES = """
    SELECT sw.id        AS schedule_id,
           sw.workflow_id,
           sw.interval_seconds,
           sw.next_run_at,
           w.workflow_data,
           w.name       AS workflow_name
    FROM scheduled_workflows sw
    JOIN workflows w ON sw.workflow_id = w.id
    WHERE sw.is_active = true AND sw.next_run_at <= $1
    ORDER BY sw.next_run_at
"""

UPDATE_NEXT_RUN = """
    UPDATE scheduled_workflows
    SET next_run_at = $1, updated_at = $2
    WHERE id = $3
"""


async def process_schedule(row, db_pool, channel):
    """Execute a single due schedule."""
    now = datetime.now()
    if row["next_run_at"] > now:
        log.debug(
            "Schedule %d not yet due (in %.1fs)",
            row["schedule_id"],
            (row["next_run_at"] - now).total_seconds(),
        )
        return

    workflow_data = row["workflow_data"]
    if isinstance(workflow_data, str):
        workflow_data = json.loads(workflow_data)

    # Resolve credentials
    async with db_pool.acquire() as conn:
        workflow_data = await resolve_credentials(workflow_data, conn)

    # Publish to RabbitMQ
    exec_id = await publish_workflow(channel, row["workflow_id"], workflow_data)
    log.info(
        "Executed schedule %d | workflow=%s (id=%d) | execution=%s",
        row["schedule_id"], row["workflow_name"], row["workflow_id"], exec_id,
    )

    # Advance next_run_at
    next_run = now + timedelta(seconds=row["interval_seconds"])
    async with db_pool.acquire() as conn:
        await conn.execute(UPDATE_NEXT_RUN, next_run, now, row["schedule_id"])


async def poll(db_pool, channel):
    """Single poll iteration: fetch due schedules and process them."""
    cutoff = datetime.now() + timedelta(seconds=LOOK_AHEAD)
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(FETCH_DUE_SCHEDULES, cutoff)

    if not rows:
        return

    results = await asyncio.gather(
        *(process_schedule(r, db_pool, channel) for r in rows),
        return_exceptions=True,
    )
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            log.error("Schedule %d failed: %s", rows[i]["schedule_id"], result)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


async def main():
    log.info("Starting scheduler (poll=%ds, look_ahead=%ds)", POLL_INTERVAL, LOOK_AHEAD)

    db_pool = await asyncpg.create_pool(POSTGRES_DSN, min_size=1, max_size=5)
    mq = await aio_pika.connect_robust(RABBITMQ_URL)
    channel = await mq.channel()
    await channel.declare_queue(RABBITMQ_QUEUE, durable=True)

    log.info("Connected to PostgreSQL and RabbitMQ")

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)

    while not stop.is_set():
        try:
            await poll(db_pool, channel)
        except Exception:
            log.exception("Poll error")

        try:
            await asyncio.wait_for(stop.wait(), timeout=POLL_INTERVAL)
        except asyncio.TimeoutError:
            pass  # normal — just means the sleep finished

    log.info("Shutting down")
    await mq.close()
    await db_pool.close()


if __name__ == "__main__":
    asyncio.run(main())
