import uuid

from fastapi import APIRouter, Depends, status

from src.core.config import get_settings
from src.core.dependencies import (
    DatabaseDep,
    get_current_user,
    require_password_changed,
)
from src.core.exceptions import BadRequest
from src.core.responses import ApiResponse
from src.db.models import User, Workflow
from src.executions.service import ExecutionTokenService
from src.queue.rabbitmq import get_rabbitmq
from src.workflow.dependencies import get_workflow_with_permission
from src.workflow.permissions import require_workflow_permission
from src.workflow.queue import WorkflowQueueService
from src.workflow.schemas import (
    ScheduleInfo,
    WorkflowCreate,
    WorkflowDetail,
    WorkflowListItem,
    WorkflowUpdateData,
    WorkflowUpdateName,
)
from src.workflow.service import WorkflowService

router = APIRouter(prefix="/workflows", tags=["Workflows"])


def get_workflow_service(db: DatabaseDep) -> WorkflowService:
    """Dependency to get workflow service instance."""
    return WorkflowService(db=db)


def get_queue_service(connection=Depends(get_rabbitmq)) -> WorkflowQueueService:
    """Dependency to get workflow queue service instance."""
    return WorkflowQueueService(
        connection=connection, queue_name=get_settings().rabbitmq_workflow_queue
    )


def get_token_service(connection=Depends(get_rabbitmq)) -> ExecutionTokenService:
    """Dependency to get execution token service instance."""
    return ExecutionTokenService(
        connection=connection, queue_name=get_settings().rabbitmq_token_queue
    )


@router.get("/", response_model=ApiResponse[list[WorkflowListItem]])
async def list_workflows(
    current_user: User = Depends(require_password_changed),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[list[WorkflowListItem]]:
    wfs = await service.list_for_user(current_user.id, include_schedule=True)
    items = [
        WorkflowListItem(
            id=wf.id,
            name=wf.name,
            trigger_type=wf.trigger_type,
            role=role,
            schedule=ScheduleInfo.model_validate(wf.schedule)
            if wf.schedule
            else None,
        )
        for wf, role in wfs
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
    wf = await service.create(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        workflow_data=payload.workflow_data,
    )

    detail = WorkflowDetail.model_validate(wf)

    return ApiResponse(success=True, message="Workflow created", data=detail)


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
    wf = await service.update_workflow_data(workflow, payload.workflow_data)
    detail = WorkflowDetail.model_validate(wf)
    return ApiResponse(success=True, message="Workflow data updated", data=detail)


@router.patch(
    "/{workflow_id}/schedule/toggle", response_model=ApiResponse[ScheduleInfo]
)
@require_workflow_permission("edit")
async def toggle_schedule(
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[ScheduleInfo]:
    """
    Toggle the active state of a workflow's schedule.

    **Requires:** EDIT permission (OWNER or EDITOR)
    """
    is_active = await service.toggle_schedule(workflow)
    return ApiResponse(
        success=True,
        message=f"Schedule {'activated' if is_active else 'paused'}",
        data=ScheduleInfo(is_active=is_active),
    )


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
    current_user: User = Depends(require_password_changed),
    workflow_service: WorkflowService = Depends(get_workflow_service),
    queue_service: WorkflowQueueService = Depends(get_queue_service),
    token_service: ExecutionTokenService = Depends(get_token_service),
) -> ApiResponse[str]:
    """
    Queue a workflow for execution.

    **Requires:** EXECUTE permission (OWNER or EDITOR, not VIEWER)
    """
    resolved_workflow_data = await workflow_service.resolve_workflow_credentials(
        workflow.workflow_data
    )

    execution_id = str(uuid.uuid4())

    await token_service.publish_execution_token(
        workflow_id=workflow.id,
        user_id=current_user.id,
        execution_id=execution_id,
    )

    try:
        await queue_service.publish_workflow_run(
            workflow_id=workflow.id,
            execution_id=execution_id,
            workflow_data=resolved_workflow_data,
        )
    except ValueError as e:
        raise BadRequest(detail=str(e))

    return ApiResponse(success=True, message="Workflow run queued", data=execution_id)
