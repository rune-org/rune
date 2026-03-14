from fastapi import APIRouter, Depends

from src.core.dependencies import require_password_changed
from src.core.responses import ApiResponse
from src.db.models import User, Workflow
from src.executions.dependencies import get_execution_service, get_token_service
from src.executions.schemas import ExecutionListItem
from src.executions.service import ExecutionService, ExecutionTokenService
from src.workflow.dependencies import get_workflow_with_permission
from src.workflow.permissions import require_workflow_permission

router = APIRouter(prefix="/executions", tags=["Executions"])


@router.get("/", response_model=ApiResponse[list[ExecutionListItem]])
async def list_user_executions(
    current_user: User = Depends(require_password_changed),
    service: ExecutionService = Depends(get_execution_service),
) -> ApiResponse[list[ExecutionListItem]]:
    """
    List all executions the current user has access to.

    Returns executions for all workflows where the user has at least VIEWER access.
    Admins can see all executions.
    """
    items = await service.list_for_user(current_user)
    return ApiResponse(success=True, message="Executions retrieved", data=items)


@router.get("/workflows/{workflow_id}", response_model=ApiResponse[None])
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


@router.get("/workflows/{workflow_id}/{execution_id}", response_model=ApiResponse[None])
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
