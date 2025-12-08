"""API router for scheduled workflow operations."""

from fastapi import APIRouter, Depends, status

from src.scheduler.schemas import (
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleDetail,
    ScheduleListItem,
)
from src.scheduler.service import ScheduledWorkflowService
from src.workflow.service import WorkflowService
from src.workflow.dependencies import get_workflow_with_permission
from src.workflow.permissions import require_workflow_permission
from src.core.dependencies import DatabaseDep, require_password_changed
from src.core.responses import ApiResponse
from src.core.exceptions import NotFound
from src.db.models import User, Workflow

router = APIRouter(prefix="/schedules", tags=["Schedules"])


def get_scheduler_service(db: DatabaseDep) -> ScheduledWorkflowService:
    """Dependency to get scheduler service instance."""
    return ScheduledWorkflowService(db=db)


def get_workflow_service(db: DatabaseDep) -> WorkflowService:
    """Dependency to get workflow service instance."""
    return WorkflowService(db=db)


@router.get("/", response_model=ApiResponse[list[ScheduleListItem]])
async def list_all_schedules(
    current_user: User = Depends(require_password_changed),
    scheduler_service: ScheduledWorkflowService = Depends(get_scheduler_service),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[list[ScheduleListItem]]:
    """
    List all schedules for workflows the user has access to.

    Returns schedule information including workflow name and next run time.
    """
    # Get all workflows accessible by the user
    user_workflows = await workflow_service.list_for_user(current_user.id)
    workflow_ids = {wf.id for wf in user_workflows}

    # Get all schedules
    all_schedules = await scheduler_service.list_all_schedules()

    # Filter schedules to only include workflows the user has access to
    user_schedules = [s for s in all_schedules if s.workflow_id in workflow_ids]

    # Build workflow ID to name mapping
    workflow_map = {wf.id: wf.name for wf in user_workflows}

    # Build response items
    items = [
        ScheduleListItem(
            id=schedule.id,
            workflow_id=schedule.workflow_id,
            workflow_name=workflow_map.get(schedule.workflow_id, "Unknown"),
            is_active=schedule.is_active,
            interval_seconds=schedule.interval_seconds,
            next_run_at=schedule.next_run_at,
            last_run_at=schedule.last_run_at,
            run_count=schedule.run_count,
        )
        for schedule in user_schedules
    ]

    return ApiResponse(
        success=True,
        message=f"Found {len(items)} schedule(s)",
        data=items,
    )


@router.get("/workflow/{workflow_id}", response_model=ApiResponse[ScheduleDetail])
@require_workflow_permission("view")
async def get_workflow_schedule(
    workflow: Workflow = Depends(get_workflow_with_permission),
    scheduler_service: ScheduledWorkflowService = Depends(get_scheduler_service),
) -> ApiResponse[ScheduleDetail]:
    """
    Get the schedule for a specific workflow.

    **Requires:** VIEW permission (OWNER, EDITOR, or VIEWER)
    """
    schedule = await scheduler_service.get_schedule_by_workflow_id(workflow.id)
    if not schedule:
        raise NotFound(detail="No schedule found for this workflow")

    detail = ScheduleDetail.model_validate(schedule)
    return ApiResponse(
        success=True,
        message="Schedule retrieved",
        data=detail,
    )


@router.post(
    "/workflow/{workflow_id}",
    response_model=ApiResponse[ScheduleDetail],
    status_code=status.HTTP_201_CREATED,
)
@require_workflow_permission("edit")
async def create_workflow_schedule(
    payload: ScheduleCreate,
    workflow: Workflow = Depends(get_workflow_with_permission),
    scheduler_service: ScheduledWorkflowService = Depends(get_scheduler_service),
) -> ApiResponse[ScheduleDetail]:
    """
    Create a schedule for a workflow.

    **Requires:** EDIT permission (OWNER or EDITOR)

    Creates a recurring schedule that will automatically trigger the workflow
    at the specified interval.
    """
    schedule = await scheduler_service.create_schedule(
        workflow_id=workflow.id,
        interval_seconds=payload.interval_seconds,
        start_at=payload.start_at,
        is_active=payload.is_active,
    )

    detail = ScheduleDetail.model_validate(schedule)
    return ApiResponse(
        success=True,
        message="Schedule created",
        data=detail,
    )


@router.put("/workflow/{workflow_id}", response_model=ApiResponse[ScheduleDetail])
@require_workflow_permission("edit")
async def update_workflow_schedule(
    payload: ScheduleUpdate,
    workflow: Workflow = Depends(get_workflow_with_permission),
    scheduler_service: ScheduledWorkflowService = Depends(get_scheduler_service),
) -> ApiResponse[ScheduleDetail]:
    """
    Update the schedule for a workflow.

    **Requires:** EDIT permission (OWNER or EDITOR)

    Updates interval or start time of the schedule.
    """
    schedule = await scheduler_service.get_schedule_by_workflow_id(workflow.id)
    if not schedule:
        raise NotFound(detail="No schedule found for this workflow")

    updated_schedule = await scheduler_service.update_schedule(
        schedule=schedule,
        interval_seconds=payload.interval_seconds,
        start_at=payload.start_at,
    )

    detail = ScheduleDetail.model_validate(updated_schedule)
    return ApiResponse(
        success=True,
        message="Schedule updated",
        data=detail,
    )


@router.delete("/workflow/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_workflow_permission("edit")
async def delete_workflow_schedule(
    workflow: Workflow = Depends(get_workflow_with_permission),
    scheduler_service: ScheduledWorkflowService = Depends(get_scheduler_service),
) -> None:
    """
    Delete the schedule for a workflow.

    **Requires:** EDIT permission (OWNER or EDITOR)

    Removes the recurring schedule. The workflow itself is not deleted.
    """
    schedule = await scheduler_service.get_schedule_by_workflow_id(workflow.id)
    if not schedule:
        raise NotFound(detail="No schedule found for this workflow")

    await scheduler_service.delete_schedule(schedule)
    return


@router.post(
    "/workflow/{workflow_id}/activate", response_model=ApiResponse[ScheduleDetail]
)
@require_workflow_permission("edit")
async def activate_workflow_schedule(
    workflow: Workflow = Depends(get_workflow_with_permission),
    scheduler_service: ScheduledWorkflowService = Depends(get_scheduler_service),
) -> ApiResponse[ScheduleDetail]:
    """
    Activate a workflow schedule.

    **Requires:** EDIT permission (OWNER or EDITOR)
    """
    schedule = await scheduler_service.get_schedule_by_workflow_id(workflow.id)
    if not schedule:
        raise NotFound(detail="No schedule found for this workflow")

    updated_schedule = await scheduler_service.update_schedule(
        schedule=schedule,
        is_active=True,
    )

    detail = ScheduleDetail.model_validate(updated_schedule)
    return ApiResponse(
        success=True,
        message="Schedule activated",
        data=detail,
    )


@router.post(
    "/workflow/{workflow_id}/deactivate", response_model=ApiResponse[ScheduleDetail]
)
@require_workflow_permission("edit")
async def deactivate_workflow_schedule(
    workflow: Workflow = Depends(get_workflow_with_permission),
    scheduler_service: ScheduledWorkflowService = Depends(get_scheduler_service),
) -> ApiResponse[ScheduleDetail]:
    """
    Deactivate a workflow schedule.

    **Requires:** EDIT permission (OWNER or EDITOR)
    """
    schedule = await scheduler_service.get_schedule_by_workflow_id(workflow.id)
    if not schedule:
        raise NotFound(detail="No schedule found for this workflow")

    updated_schedule = await scheduler_service.update_schedule(
        schedule=schedule,
        is_active=False,
    )

    detail = ScheduleDetail.model_validate(updated_schedule)
    return ApiResponse(
        success=True,
        message="Schedule deactivated",
        data=detail,
    )
