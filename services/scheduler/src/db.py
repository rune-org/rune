import asyncio
from datetime import datetime, timedelta, timezone

from src.config import log

FETCH_DUE_SCHEDULES = """
    SELECT sw.id        AS schedule_id,
           sw.workflow_id,
           sw.interval_seconds,
           sw.next_run_at,
           w.name       AS workflow_name
    FROM scheduled_workflows sw
    JOIN workflows w ON sw.workflow_id = w.id
    WHERE w.is_active = true AND sw.next_run_at <= $1
    ORDER BY sw.next_run_at
    FOR UPDATE OF sw SKIP LOCKED
"""

UPDATE_NEXT_RUN = """
    UPDATE scheduled_workflows
    SET next_run_at = $1, updated_at = $2
    WHERE id = $3
"""


async def poll(conn, api_client) -> None:
    """Single poll iteration: fetch due schedules and process them."""
    now = datetime.now(timezone.utc)

    async with conn.transaction():
        rows = await conn.fetch(FETCH_DUE_SCHEDULES, now)

        if not rows:
            return

        for row in rows:
            next_run = now + timedelta(seconds=row["interval_seconds"])
            await conn.execute(UPDATE_NEXT_RUN, next_run, now, row["schedule_id"])

    results = await asyncio.gather(
        *(api_client.trigger_workflow(row["workflow_id"]) for row in rows),
        return_exceptions=True,
    )

    for i, result in enumerate(results):
        if isinstance(result, Exception):
            log.error("Schedule %d failed: %s", rows[i]["schedule_id"], result)
        else:
            log.info(
                "Executed schedule %d | workflow=%s (id=%d) | execution=%s",
                rows[i]["schedule_id"],
                rows[i]["workflow_name"],
                rows[i]["workflow_id"],
                result,
            )
