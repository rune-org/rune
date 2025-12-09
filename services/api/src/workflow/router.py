import uuid
from fastapi import APIRouter, Depends, status, Query

from src.workflow.schemas import (
    WorkflowListItem,
    WorkflowCreate,
    WorkflowDetail,
    WorkflowUpdateName,
    WorkflowUpdateData,
    ScheduleInfo,
)
from src.workflow.triggers import (
    ScheduleTriggerService,
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


def get_schedule_trigger_service(db: DatabaseDep) -> ScheduleTriggerService:
    """Dependency to get schedule trigger service instance."""
    return ScheduleTriggerService(db=db)


def get_queue_service(connection=Depends(get_rabbitmq)) -> WorkflowQueueService:
    """Dependency to get workflow queue service instance."""
    settings = get_settings()
    return WorkflowQueueService(
        connection=connection, queue_name=settings.rabbitmq_queue_name
    )


@router.get("/", response_model=ApiResponse[list[WorkflowListItem]])
async def list_workflows(
    include_schedule: bool = Query(
        default=False,
        description="Include schedule information for scheduled workflows",
    ),
    current_user: User = Depends(require_password_changed),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[list[WorkflowListItem]]:
    """
    List all workflows accessible by the current user.

    Use `include_schedule=true` to get schedule information in a single query.
    This is more efficient than fetching schedules separately for each workflow.
    """
    wfs = await service.list_for_user(
        current_user.id, include_schedule=include_schedule
    )

    items = []
    for wf in wfs:
        # Build schedule info if loaded
        schedule_info = None
        if include_schedule and wf.schedule:
            schedule_info = ScheduleInfo.model_validate(wf.schedule)

        item = WorkflowListItem(
            id=wf.id, name=wf.name, trigger_type=wf.trigger_type, schedule=schedule_info
        )
        items.append(item)

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
    schedule_trigger_service: ScheduleTriggerService = Depends(
        get_schedule_trigger_service
    ),
) -> ApiResponse[WorkflowDetail]:
    """Create a new workflow.

    Automatically detects trigger type from workflow_data:
    - If workflow contains schedule configuration in trigger node, creates schedule automatically
    - If workflow contains webhook configuration, sets up webhook trigger
    - Otherwise, workflow is manual-only
    """
    wf = await service.create(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        workflow_data=payload.workflow_data,
    )

    # If workflow has schedule configuration, create the schedule automatically
    schedule_config = service._extract_schedule_config(payload.workflow_data)
    if schedule_config:
        await schedule_trigger_service.create_schedule(
            workflow_id=wf.id,
            interval_seconds=schedule_config["interval_seconds"],
            start_at=schedule_config.get("start_at"),
            is_active=schedule_config.get("is_active", True),
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
    schedule_trigger_service: ScheduleTriggerService = Depends(
        get_schedule_trigger_service
    ),
) -> ApiResponse[WorkflowDetail]:
    """
    Update workflow data/definition.

    **Requires:** EDIT permission (OWNER or EDITOR)

    Automatically manages schedule based on workflow_data:
    - Creates schedule if workflow_data contains schedule configuration
    - Updates existing schedule if configuration changed
    - Deletes schedule if schedule configuration removed
    """
    # Get current schedule before updating
    existing_schedule = await schedule_trigger_service.get_schedule(workflow.id)

    # Update workflow data (this also updates trigger_type automatically)
    wf = await service.update_workflow_data(workflow, payload.workflow_data)

    # Check new schedule configuration
    schedule_config = service._extract_schedule_config(payload.workflow_data)

    if schedule_config:
        # Schedule configuration exists in new workflow_data
        if existing_schedule:
            # Update existing schedule
            await schedule_trigger_service.update_schedule(
                schedule=existing_schedule,
                interval_seconds=schedule_config["interval_seconds"],
                start_at=schedule_config.get("start_at"),
                is_active=schedule_config.get("is_active", existing_schedule.is_active),
            )
        else:
            # Create new schedule
            await schedule_trigger_service.create_schedule(
                workflow_id=wf.id,
                interval_seconds=schedule_config["interval_seconds"],
                start_at=schedule_config.get("start_at"),
                is_active=schedule_config.get("is_active", True),
            )
    else:
        # No schedule configuration in new workflow_data
        if existing_schedule:
            # Delete existing schedule
            await schedule_trigger_service.delete_schedule(existing_schedule)

    detail = WorkflowDetail.model_validate(wf)
    return ApiResponse(success=True, message="Workflow data updated", data=detail)


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_workflow_permission("delete")
async def delete_workflow(
    workflow: Workflow = Depends(get_workflow_with_permission),
    current_user: User = Depends(get_current_user),
    service: WorkflowService = Depends(get_workflow_service),
    schedule_trigger_service: ScheduleTriggerService = Depends(
        get_schedule_trigger_service
    ),
) -> None:
    """
    Delete a workflow.

    **Requires:** DELETE permission (OWNER only)

    Automatically deletes associated schedule if it exists.
    """
    # Delete schedule if it exists (will be deleted by cascade, but we do it explicitly for clarity)
    existing_schedule = await schedule_trigger_service.get_schedule(workflow.id)
    if existing_schedule:
        await schedule_trigger_service.delete_schedule(existing_schedule)

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
