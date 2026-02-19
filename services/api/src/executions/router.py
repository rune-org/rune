from fastapi import APIRouter, Depends

from src.core.dependencies import require_password_changed
from src.core.responses import ApiResponse
from src.db.models import User, Workflow
from src.workflow.dependencies import get_workflow_with_permission
from src.workflow.permissions import require_workflow_permission
from src.queue.rabbitmq import get_rabbitmq
from src.core.config import get_settings
from src.executions.service import ExecutionTokenService


router = APIRouter(prefix="/workflows", tags=["Executions"])


def get_token_service(connection=Depends(get_rabbitmq)) -> ExecutionTokenService:
    """Dependency to get execution token service instance."""
    return ExecutionTokenService(
        connection=connection, queue_name=get_settings().rabbitmq_token_queue
    )


@router.get("/{workflow_id}/executions", response_model=ApiResponse[None])
@require_workflow_permission("view")
async def get_workflow_executions(
    workflow: Workflow = Depends(get_workflow_with_permission),
    current_user: User = Depends(require_password_changed),
    token_service: ExecutionTokenService = Depends(get_token_service),
) -> ApiResponse[None]:
    """
    Get access token for viewing all executions of a workflow.

    Publishes a wildcard execution token (execution_id=null) to RTES,
    allowing the frontend to view all executions for this workflow.

    **Requires:** VIEW permission (OWNER, EDITOR, or VIEWER)
    """
    # Publish wildcard token (execution_id=None) for all executions
    await token_service.publish_execution_token(
        workflow_id=workflow.id,
        user_id=current_user.id,
        execution_id=None,  # Wildcard - access all executions
    )

    return ApiResponse(success=True, message="Execution access granted", data=None)


@router.get(
    "/{workflow_id}/executions/{execution_id}", response_model=ApiResponse[None]
)
@require_workflow_permission("view")
async def get_execution(
    execution_id: str,
    workflow: Workflow = Depends(get_workflow_with_permission),
    current_user: User = Depends(require_password_changed),
    token_service: ExecutionTokenService = Depends(get_token_service),
) -> ApiResponse[None]:
    """
    Get access token for viewing a specific execution.

    Publishes a scoped execution token to RTES,
    allowing the frontend to view this specific execution.

    **Requires:** VIEW permission (OWNER, EDITOR, or VIEWER)
    """
    # Publish scoped token for specific execution
    await token_service.publish_execution_token(
        workflow_id=workflow.id,
        user_id=current_user.id,
        execution_id=execution_id,
    )

    return ApiResponse(success=True, message="Execution access granted", data=None)
