from fastapi import APIRouter, Depends, Query
from src.core.exceptions import BadRequest
from src.core.dependencies import require_password_changed
from src.core.responses import ApiResponse, PaginatedData
from src.db.models import User, Workflow, ExecutionStatus
from src.executions.dependencies import get_execution_service, get_token_service
from src.executions.schemas import ExecutionListItem
from src.executions.service import ExecutionService, ExecutionTokenService
from src.workflow.dependencies import get_workflow_with_permission
from src.workflow.permissions import require_workflow_permission

router = APIRouter(prefix="/executions", tags=["Executions"])


MAX_EXECUTION_PAGE_SIZE = 50


@router.get(
    "/",
    response_model=ApiResponse[
        list[ExecutionListItem] | PaginatedData[ExecutionListItem]
    ],
)
async def list_user_executions(
    page: int | None = Query(None, ge=1, description="Page number (1-based)"),
    page_size: int | None = Query(
        None,
        ge=1,
        le=MAX_EXECUTION_PAGE_SIZE,
        description="Number of executions per page",
    ),
    search: str | None = None,
    status: ExecutionStatus | None = Query(
        None, description="Filter by execution status"
    ),
    current_user: User = Depends(require_password_changed),
    service: ExecutionService = Depends(get_execution_service),
) -> ApiResponse[list[ExecutionListItem] | PaginatedData[ExecutionListItem]]:
    """
    List all executions the current user has access to.

    Returns executions for all workflows where the user has at least VIEWER access.
    Admins can see all executions.
    """
    if (page is None) != (page_size is None):
        raise BadRequest(
            detail="Both page and page_size are required for paginated results"
        )

    limit = page_size if page_size is not None else None
    offset = (
        (page - 1) * page_size if (page is not None and page_size is not None) else None
    )

    items, total = await service.list_for_user(
        current_user,
        limit=limit,
        offset=offset,
        search=search,
        status=status,
    )

    if page is not None and page_size is not None:
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        paginated_data = PaginatedData(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
        return ApiResponse(
            success=True, message="Executions retrieved", data=paginated_data
        )

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
