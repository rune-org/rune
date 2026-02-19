import time
from aio_pika import RobustConnection

from src.queue.base import BaseQueuePublisher
from src.executions.schemas import ExecutionTokenMessage


class ExecutionTokenService(BaseQueuePublisher):
    """Service for publishing execution tokens to RTES."""

    def __init__(self, connection: RobustConnection, queue_name: str):
        """
        Initialize the execution token service.

        Args:
            connection: RabbitMQ connection instance
            queue_name: Name of the RabbitMQ queue to publish tokens to
        """
        super().__init__(connection, queue_name)

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

        await self._publish(token, durable=False)

        return token
