from fastapi import Depends

from src.core.config import get_settings
from src.core.dependencies import DatabaseDep
from src.executions.service import ExecutionService, ExecutionTokenService
from src.queue.rabbitmq import get_rabbitmq


def get_execution_service(db: DatabaseDep) -> ExecutionService:
    """Dependency to get execution service instance."""
    return ExecutionService(db=db)


def get_token_service(connection=Depends(get_rabbitmq)) -> ExecutionTokenService:
    """Dependency to get execution token service instance."""
    return ExecutionTokenService(
        connection=connection, queue_name=get_settings().rabbitmq_token_queue
    )
