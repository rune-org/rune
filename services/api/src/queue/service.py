from aio_pika import RobustConnection, Message
from src.workflow.schemas import NodeExecutionMessage


class WorkflowQueueService:
    """Service for publishing workflow run messages to RabbitMQ."""

    def __init__(self, connection: RobustConnection, queue_name: str):
        """
        Initialize the workflow queue service.

        Args:
            connection: RabbitMQ connection instance
            queue_name: Name of the queue to use
        """
        self.connection = connection
        self.queue_name = queue_name

    async def publish_workflow_run(self, payload: NodeExecutionMessage) -> None:
        """
        Publish a workflow run message to the queue.

        Creates a durable queue and publishes a persistent message containing
        the workflow ID, execution ID, and workflow data for the worker to consume and execute.

        Args:
            payload: NodeExecutionMessage to publish (will be JSON encoded)
        """

        # Create a channel for this operation
        channel = await self.connection.channel()

        # Declare the queue (idempotent - safe to call multiple times)
        await channel.declare_queue(self.queue_name, durable=True)

        body_bytes = payload.model_dump_json().encode("utf-8")

        # Publish the message with persistence
        await channel.default_exchange.publish(
            Message(
                body=body_bytes,
                delivery_mode=2,  # Persistent message (survives broker restart)
            ),
            routing_key=self.queue_name,
        )

        # Clean up the channel
        await channel.close()
