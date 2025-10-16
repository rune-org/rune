import json
from aio_pika import RobustConnection, Message


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

    async def publish_workflow_run(
        self, workflow_id: int, user_id: int, workflow_data: dict
    ) -> None:
        """
        Publish a workflow run message to the queue.

        Creates a durable queue and publishes a persistent message containing
        the workflow ID, user ID, and workflow data for the worker to consume and execute.

        Args:
            workflow_id: The ID of the workflow to run
            user_id: The ID of the user who triggered the run
            workflow_data: The workflow definition data
        """
        # Create a channel for this operation
        channel = await self.connection.channel()

        # Declare the queue (idempotent - safe to call multiple times)
        await channel.declare_queue(self.queue_name, durable=True)

        # Create message payload
        message_body = json.dumps(
            {
                "workflow_id": workflow_id,
                "user_id": user_id,
                "workflow_data": workflow_data,
            }
        )

        # Publish the message with persistence
        await channel.default_exchange.publish(
            Message(
                body=message_body.encode(),
                delivery_mode=2,  # Persistent message (survives broker restart)
            ),
            routing_key=self.queue_name,
        )

        # Clean up the channel
        await channel.close()
