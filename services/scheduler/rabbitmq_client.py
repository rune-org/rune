"""RabbitMQ message queue management."""

import json
import logging
from typing import Any, Optional
import asyncio

import aio_pika
from aio_pika import Message, DeliveryMode
from aio_pika.abc import AbstractRobustConnection


logger = logging.getLogger("scheduler.queue")


class MessageQueue:
    """Manages RabbitMQ connection with automatic reconnection."""

    def __init__(self, url: str, queue_name: str, max_retries: int = 5):
        """
        Initialize message queue manager.

        Args:
            url: RabbitMQ connection URL
            queue_name: Queue name for workflow messages
            max_retries: Maximum connection attempts
        """
        self.url = url
        self.queue_name = queue_name
        self.max_retries = max_retries
        self.connection: Optional[AbstractRobustConnection] = None
        self.channel = None
        self.queue = None

    async def connect(self):
        """Establish RabbitMQ connection with retry logic."""
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info(
                    f"Connecting to RabbitMQ (attempt {attempt}/{self.max_retries})..."
                )
                self.connection = await aio_pika.connect_robust(
                    self.url,
                    timeout=30,
                )
                self.channel = await self.connection.channel()

                # Declare queue (idempotent)
                self.queue = await self.channel.declare_queue(
                    self.queue_name, durable=True, auto_delete=False
                )

                logger.info(
                    f"RabbitMQ connection established (queue: {self.queue_name})"
                )
                return
            except Exception as e:
                logger.error(f"RabbitMQ connection attempt {attempt} failed: {e}")
                if attempt < self.max_retries:
                    wait_time = min(2**attempt, 30)
                    logger.info(f"Retrying in {wait_time} seconds...")
                    await asyncio.sleep(wait_time)
                else:
                    logger.critical("Failed to connect to RabbitMQ after all retries")
                    raise

    async def publish_workflow(
        self, workflow_id: int, schedule_id: int, workflow_data: dict[str, Any]
    ) -> bool:
        """
        Publish workflow execution message to RabbitMQ.
        Cloned from API's WorkflowQueueService to ensure compatibility.

        Args:
            workflow_id: Workflow ID to execute
            schedule_id: Schedule ID that triggered execution (not used in message)
            workflow_data: Workflow definition data with nodes and edges

        Returns:
            True if successful, False otherwise
        """
        try:
            import uuid
            import json as json_lib

            # Parse workflow_data if it's a string (from database)
            if isinstance(workflow_data, str):
                workflow_data = json_lib.loads(workflow_data)

            # Generate unique execution ID (same format as API)
            execution_id = str(uuid.uuid4())

            # === CLONED FROM API: services/api/src/queue/service.py ===

            # Find trigger nodes and the first executable nodes
            nodes = workflow_data.get("nodes", [])
            edges = workflow_data.get("edges", [])

            if not nodes:
                logger.error("Workflow has no nodes to execute")
                return False

            # Validate trigger nodes - must have exactly one
            trigger_nodes = [node for node in nodes if node.get("trigger", False)]

            if len(trigger_nodes) != 1:
                logger.error(
                    f"Workflow must have exactly one trigger node, found {len(trigger_nodes)}"
                )
                return False

            # Get the single trigger node
            trigger_node = trigger_nodes[0]
            trigger_node_id = trigger_node.get("id")

            # Find the executable nodes the trigger points to
            first_nodes = []

            for edge in edges:
                if edge.get("src") == trigger_node_id:
                    # This edge comes from the trigger node
                    dst_node_id = edge.get("dst")
                    first_nodes.append(dst_node_id)

            if not first_nodes:
                logger.error("No nodes connected after trigger")
                return False

            # For now, use the first one (in the future, might send multiple messages)
            first_node = first_nodes[0]

            # Create NodeExecutionMessage payload (matching API's schema)
            payload = {
                "workflow_id": str(workflow_id),
                "execution_id": execution_id,
                "current_node": first_node,
                "workflow_definition": workflow_data,
                "accumulated_context": {},
            }

            # === END CLONED SECTION ===

            body_bytes = json.dumps(payload).encode("utf-8")

            message = Message(
                body=body_bytes,
                delivery_mode=DeliveryMode.PERSISTENT,
                content_type="application/json",
            )

            await self.channel.default_exchange.publish(
                message, routing_key=self.queue_name
            )

            logger.info(
                f"Published workflow execution: workflow_id={workflow_id}, "
                f"schedule_id={schedule_id}, execution_id={execution_id}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to publish workflow {workflow_id}: {e}")
            return False

    async def close(self):
        """Close RabbitMQ connection."""
        if self.connection and not self.connection.is_closed:
            await self.connection.close()
            logger.info("RabbitMQ connection closed")

    async def healthcheck(self) -> bool:
        """Check RabbitMQ connection health."""
        try:
            return self.connection and not self.connection.is_closed
        except Exception:
            return False
