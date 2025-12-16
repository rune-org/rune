import time
from aio_pika import RobustConnection, Message
from pydantic import BaseModel

from src.queue.messages import NodeExecutionMessage, ExecutionTokenMessage
from src.core.config import get_settings


class BaseQueuePublisher:
    """
    Base class for publishing messages to RabbitMQ.

    Provides shared functionality for queue declaration and message publishing.
    Subclasses should use _publish() with their specific queue name.
    """

    def __init__(self, connection: RobustConnection):
        """
        Initialize the base publisher.

        Args:
            connection: RabbitMQ connection instance
        """
        self.connection = connection

    async def _publish(
        self,
        queue_name: str,
        message: BaseModel,
        durable: bool = True,
    ) -> None:
        """
        Publish a Pydantic model to a queue.

        Args:
            queue_name: Name of the queue to publish to
            message: Pydantic model to serialize and publish
            durable: Whether the queue should be durable (default: True)
        """
        channel = await self.connection.channel()

        try:
            # Declare the queue (idempotent - safe to call multiple times)
            await channel.declare_queue(queue_name, durable=durable)

            body_bytes = message.model_dump_json().encode("utf-8")

            # Publish the message with persistence
            await channel.default_exchange.publish(
                Message(
                    body=body_bytes,
                    delivery_mode=2,  # Persistent message (survives broker restart)
                ),
                routing_key=queue_name,
            )
        finally:
            await channel.close()


class WorkflowQueueService(BaseQueuePublisher):
    """Service for publishing workflow execution messages to RabbitMQ."""

    def __init__(self, connection: RobustConnection):
        """
        Initialize the workflow queue service.

        Args:
            connection: RabbitMQ connection instance
        """
        super().__init__(connection)
        settings = get_settings()
        self.queue_name = settings.rabbitmq_workflow_queue

    async def publish_workflow_run(
        self,
        workflow_id: int,
        execution_id: str,
        workflow_data: dict,
    ) -> None:
        """
        Publish a workflow run message to the queue.

        Creates a NodeExecutionMessage with the proper structure
        including workflow_id, execution_id, current_node (first node), workflow_definition,
        and accumulated_context (with trigger data).

        Args:
            workflow_id: The workflow database ID
            execution_id: Unique execution instance identifier
            workflow_data: The resolved workflow definition (nodes and edges)

        Raises:
            ValueError: If workflow has invalid structure
        """
        # Find trigger nodes and the first executable nodes
        nodes = workflow_data.get("nodes", [])
        edges = workflow_data.get("edges", [])

        if not nodes:
            raise ValueError("Workflow has no nodes to execute")

        # Validate trigger nodes - must have exactly one
        trigger_nodes = [node for node in nodes if node.get("trigger", False)]

        if len(trigger_nodes) != 1:
            raise ValueError("Workflow must have exactly one trigger node")

        # Get the single trigger node
        trigger_node = trigger_nodes[0]
        trigger_node_id = trigger_node.get("id")

        # Find the executable nodes the trigger points to
        first_nodes = []

        for edge in edges:
            if edge.get("src") == trigger_node_id:
                dst_node_id = edge.get("dst")
                first_nodes.append(dst_node_id)

        if not first_nodes:
            return None

        # For now, use the first one (in the future, might send multiple messages)
        first_node = first_nodes[0]

        payload = NodeExecutionMessage(
            workflow_id=str(workflow_id),
            execution_id=execution_id,
            current_node=first_node,
            workflow_definition=workflow_data,
        )

        await self._publish(self.queue_name, payload,durable=False)


class ExecutionTokenService(BaseQueuePublisher):
    """Service for publishing execution tokens to RTES."""

    def __init__(self, connection: RobustConnection):
        """
        Initialize the execution token service.

        Args:
            connection: RabbitMQ connection instance
        """
        super().__init__(connection)
        settings = get_settings()
        self.queue_name = settings.rabbitmq_token_queue

    async def publish_execution_token(
        self,
        workflow_id: int | str,
        user_id: int | str,
        execution_id: str | None = None,
        ttl_seconds: int = 3600,
    ) -> ExecutionTokenMessage:
        """
        Publish an execution token to RTES.

        The token allows the frontend to authenticate with RTES WebSocket
        for real-time execution updates.

        Args:
            workflow_id: The workflow database ID
            user_id: The user's database ID
            execution_id: Unique execution instance identifier (None = wildcard access)
            ttl_seconds: Token time-to-live in seconds (default: 1 hour)

        Returns:
            The published ExecutionTokenMessage
        """

        now = int(time.time())
        token = ExecutionTokenMessage(
            execution_id=execution_id,
            workflow_id=str(workflow_id),
            user_id=str(user_id),
            iat=now,
            exp=now + ttl_seconds,
        )

        await self._publish(self.queue_name, token,durable=False)

        return token
