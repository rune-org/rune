import time

from aio_pika import RobustConnection
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import Execution, User, UserRole, Workflow, WorkflowUser
from src.executions.schemas import ExecutionListItem, ExecutionTokenMessage
from src.queue.base import BaseQueuePublisher


class ExecutionService:
    """Service for querying execution records."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_for_user(self, user: User) -> list[ExecutionListItem]:
        """Return all executions the user has access to, newest first.

        Admins see all executions. Regular users see executions
        for workflows where they have at least VIEWER access.
        """
        if user.role == UserRole.ADMIN:
            statement = (
                select(Execution, Workflow.name)
                .join(Workflow, Execution.workflow_id == Workflow.id)
                .order_by(Execution.created_at.desc())
            )
        else:
            statement = (
                select(Execution, Workflow.name)
                .join(Workflow, Execution.workflow_id == Workflow.id)
                .join(WorkflowUser, WorkflowUser.workflow_id == Workflow.id)
                .where(WorkflowUser.user_id == user.id)
                .order_by(Execution.created_at.desc())
            )

        result = await self.db.exec(statement)
        return [
            ExecutionListItem(
                id=execution.id,
                workflow_id=execution.workflow_id,
                workflow_name=workflow_name,
                status=execution.status,
                created_at=execution.created_at,
                completed_at=execution.completed_at,
                total_duration_ms=execution.total_duration_ms,
                failure_reason=execution.failure_reason,
            )
            for execution, workflow_name in result.all()
        ]


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
