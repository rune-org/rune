import logging

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel.ext.asyncio.session import AsyncSession

from src.models import CompletionMessage, Execution, ExecutionStatus

logger = logging.getLogger(__name__)


async def update_execution(engine: AsyncEngine, data: CompletionMessage) -> bool:
    """Update an execution record with completion data.

    Returns True if the execution was found and updated, False if not found.
    """
    async with AsyncSession(engine, expire_on_commit=False) as session:
        result = await session.exec(
            update(Execution)
            .where(Execution.id == data.execution_id)
            .values(
                status=ExecutionStatus(data.status),
                completed_at=data.completed_at,
                total_duration_ms=data.total_duration_ms,
                failure_reason=data.failure_reason,
            )
            .returning(Execution.id)
        )
        await session.commit()
        return result.first() is not None
