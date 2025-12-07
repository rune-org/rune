import uuid
from fastapi import APIRouter, Depends, status

from src.workflow.schemas import (
    WorkflowListItem,
    WorkflowCreate,
    WorkflowDetail,
    WorkflowUpdateName,
    WorkflowUpdateStatus,
    WorkflowUpdateData,
)
from src.workflow.service import WorkflowService
from src.core.dependencies import (
    DatabaseDep,
    require_password_changed,
    get_current_user,
)
from src.core.exceptions import BadRequest
from src.workflow.dependencies import get_workflow_with_permission
from src.workflow.permissions import require_workflow_permission
from src.core.responses import ApiResponse
from src.core.config import get_settings
from src.db.models import User, Workflow
from src.queue.rabbitmq import get_rabbitmq
from src.queue.service import WorkflowQueueService


router = APIRouter(prefix="/workflows", tags=["Workflows"])


def get_workflow_service(db: DatabaseDep) -> WorkflowService:
    """Dependency to get workflow service instance."""
    return WorkflowService(db=db)


def get_queue_service(connection=Depends(get_rabbitmq)) -> WorkflowQueueService:
    """Dependency to get workflow queue service instance."""
    settings = get_settings()
    return WorkflowQueueService(
        connection=connection, queue_name=settings.rabbitmq_queue_name
    )


@router.get("/", response_model=ApiResponse[list[WorkflowListItem]])
async def list_workflows(
    current_user: User = Depends(require_password_changed),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[list[WorkflowListItem]]:
    wfs = await service.list_for_user(current_user.id)
    items = [
        WorkflowListItem(id=wf.id, name=wf.name, is_active=wf.is_active) for wf in wfs
    ]
    return ApiResponse(success=True, message="Workflows retrieved", data=items)


@router.get("/{workflow_id}", response_model=ApiResponse[WorkflowDetail])
@require_workflow_permission("view")
async def get_workflow(
    workflow: Workflow = Depends(get_workflow_with_permission),
) -> ApiResponse[WorkflowDetail]:
    """
    Get a specific workflow by ID.

    **Requires:** VIEW permission (OWNER, EDITOR, or VIEWER)
    """
    detail = WorkflowDetail.model_validate(workflow)
    return ApiResponse(success=True, message="Workflow retrieved", data=detail)


@router.post(
    "/", response_model=ApiResponse[WorkflowDetail], status_code=status.HTTP_201_CREATED
)
async def create_workflow(
    payload: WorkflowCreate,
    current_user: User = Depends(require_password_changed),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowDetail]:
    # Convert Pydantic Workflow model to dict for database storage (JSONB field)
    workflow_data_dict = payload.workflow_data.model_dump(exclude_none=False)
    wf = await service.create(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        workflow_data=workflow_data_dict,
    )

    detail = WorkflowDetail.model_validate(wf)

    return ApiResponse(success=True, message="Workflow created", data=detail)


@router.put("/{workflow_id}/status", response_model=ApiResponse[WorkflowDetail])
@require_workflow_permission("edit")
async def update_status(
    payload: WorkflowUpdateStatus,
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowDetail]:
    """
    Update workflow status (active/inactive).

    **Requires:** EDIT permission (OWNER or EDITOR)
    """
    wf = await service.update_status(workflow, payload.is_active)
    detail = WorkflowDetail.model_validate(wf)
    return ApiResponse(success=True, message="Workflow status updated", data=detail)


@router.put("/{workflow_id}/name", response_model=ApiResponse[WorkflowDetail])
@require_workflow_permission("edit")
async def update_name(
    payload: WorkflowUpdateName,
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowDetail]:
    """
    Update workflow name.

    **Requires:** EDIT permission (OWNER or EDITOR)
    """
    wf = await service.update_name(workflow, payload.name)
    detail = WorkflowDetail.model_validate(wf)
    return ApiResponse(success=True, message="Workflow name updated", data=detail)


@router.put("/{workflow_id}/data", response_model=ApiResponse[WorkflowDetail])
@require_workflow_permission("edit")
async def update_workflow_data(
    payload: WorkflowUpdateData,
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowDetail]:
    """
    Update workflow data/definition.

    **Requires:** EDIT permission (OWNER or EDITOR)
    """
     # Convert Pydantic Workflow model to dict for database storage (JSONB field)
    # Use exclude_none=False to preserve credentials even if values is None
    workflow_data_dict = payload.workflow_data.model_dump(exclude_none=False)
    wf = await service.update_workflow_data(workflow, workflow_data_dict)
    detail = WorkflowDetail.model_validate(wf)
    return ApiResponse(success=True, message="Workflow data updated", data=detail)


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_workflow_permission("delete")
async def delete_workflow(
    workflow: Workflow = Depends(get_workflow_with_permission),
    current_user: User = Depends(get_current_user),
    service: WorkflowService = Depends(get_workflow_service),
) -> None:
    """
    Delete a workflow.

    **Requires:** DELETE permission (OWNER only)
    """
    await service.delete(workflow)
    return


@router.post("/{workflow_id}/run", response_model=ApiResponse[str])
@require_workflow_permission("execute")
async def run_workflow(
    workflow: Workflow = Depends(get_workflow_with_permission),
    workflow_service: WorkflowService = Depends(get_workflow_service),
    queue_service: WorkflowQueueService = Depends(get_queue_service),
) -> ApiResponse[dict]:
    """
    Queue a workflow for execution.

    Verifies the workflow exists and user has execute permission (OWNER or EDITOR),
    resolves all credential references in workflow nodes,
    then publishes a run message to RabbitMQ containing workflow details with resolved credentials.

    Returns execution_id for tracking the execution.

    **Requires:** EXECUTE permission (OWNER or EDITOR, not VIEWER)
    """
    # Resolve credentials for all nodes in the workflow
    resolved_workflow_data = await workflow_service.resolve_workflow_credentials(
        workflow.workflow_data
    )

    # Generate a unique execution ID
    execution_id = f"exec_{uuid.uuid4().hex[:16]}"

    # Publish workflow run message to queue with resolved credentials
    try:
        await queue_service.publish_workflow_run(
            workflow_id=workflow.id,
            execution_id=execution_id,
            workflow_data=resolved_workflow_data,
        )
    except ValueError as e:
        # Workflow validation errors (e.g., missing trigger, multiple triggers, invalid structure)
        raise BadRequest(detail=str(e))

    return ApiResponse(success=True, message="Workflow run queued", data=execution_id)
