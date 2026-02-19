from aio_pika import RobustConnection, Message
from pydantic import BaseModel


class BaseQueuePublisher:
    """
    Base class for publishing messages to RabbitMQ.

    Provides shared functionality for queue declaration and message publishing.
    Subclasses should call _publish() to send messages to self.queue_name.
    """

    def __init__(self, connection: RobustConnection, queue_name: str):
        """
        Initialize the base publisher.

        Args:
            connection: RabbitMQ connection instance
            queue_name: Name of the RabbitMQ queue to publish to
        """
        self.connection = connection
        self.queue_name = queue_name

    async def _publish(
        self,
        message: BaseModel,
        durable: bool = True,
    ) -> None:
        """
        Publish a Pydantic model to self.queue_name.

        Args:
            message: Pydantic model to serialize and publish
            durable: Whether the queue should be durable (default: True)
        """
        channel = await self.connection.channel()

        try:
            # Declare the queue (idempotent - safe to call multiple times)
            await channel.declare_queue(self.queue_name, durable=durable)

            body_bytes = message.model_dump_json().encode("utf-8")

            # Publish the message with persistence
            await channel.default_exchange.publish(
                Message(
                    body=body_bytes,
                    delivery_mode=2,  # Persistent message (survives broker restart)
                ),
                routing_key=self.queue_name,
            )
        finally:
            await channel.close()
