"""Service for managing scheduled workflows."""

import logging
from datetime import datetime, timedelta
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import ScheduledWorkflow, Workflow, TriggerType
from src.core.exceptions import NotFound, BadRequest

logger = logging.getLogger(__name__)


class ScheduledWorkflowService:
    """Service for managing scheduled workflow executions."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_schedule(
        self,
        workflow_id: int,
        interval_seconds: int,
        start_at: datetime | None = None,
        is_active: bool = True,
    ) -> ScheduledWorkflow:
        """
        Create a new schedule for a workflow.

        Args:
            workflow_id: ID of the workflow to schedule
            interval_seconds: Interval in seconds between executions
            start_at: When to start (defaults to now)
            is_active: Whether the schedule is active

        Returns:
            The created ScheduledWorkflow instance
        """
        # Verify workflow exists
        workflow = await self.db.get(Workflow, workflow_id)
        if not workflow:
            raise NotFound(detail="Workflow not found")

        # Validate workflow has a trigger node (entry point for scheduled execution)
        if not self._has_trigger_node(workflow.workflow_data):
            raise BadRequest(
                detail="Workflow must have a trigger node to be scheduled. "
                "Add a node with type='trigger' and trigger=true to your workflow."
            )

        # Check if schedule already exists for this workflow
        statement = select(ScheduledWorkflow).where(
            ScheduledWorkflow.workflow_id == workflow_id
        )
        result = await self.db.exec(statement)
        existing = result.first()
        if existing:
            raise BadRequest(
                detail="Schedule already exists for this workflow. Update or delete the existing schedule first."
            )

        start_at = start_at or datetime.now()

        # Calculate next run time
        next_run_at = self._calculate_next_run(
            datetime.now(), interval_seconds, start_at=start_at, last_run_at=None
        )

        schedule = ScheduledWorkflow(
            workflow_id=workflow_id,
            interval_seconds=interval_seconds,
            start_at=start_at,
            next_run_at=next_run_at,
            is_active=is_active,
        )

        self.db.add(schedule)

        # Update workflow trigger_type to scheduled
        workflow.trigger_type = TriggerType.SCHEDULED
        self.db.add(workflow)

        await self.db.commit()
        await self.db.refresh(schedule)

        logger.info(
            f"Created schedule for workflow {workflow_id}: every {interval_seconds} seconds, trigger_type updated to SCHEDULED"
        )

        return schedule

    async def get_schedule_by_id(self, schedule_id: int) -> ScheduledWorkflow | None:
        """Get a schedule by ID."""
        return await self.db.get(ScheduledWorkflow, schedule_id)

    async def get_schedule_by_workflow_id(
        self, workflow_id: int
    ) -> ScheduledWorkflow | None:
        """Get schedule for a specific workflow."""
        statement = select(ScheduledWorkflow).where(
            ScheduledWorkflow.workflow_id == workflow_id
        )
        result = await self.db.exec(statement)
        return result.first()

    async def list_all_schedules(self) -> list[ScheduledWorkflow]:
        """List all schedules."""
        statement = select(ScheduledWorkflow).order_by(
            ScheduledWorkflow.next_run_at.asc()
        )
        result = await self.db.exec(statement)
        return result.all()

    async def list_active_schedules(self) -> list[ScheduledWorkflow]:
        """List all active schedules."""
        statement = (
            select(ScheduledWorkflow)
            .where(ScheduledWorkflow.is_active)
            .order_by(ScheduledWorkflow.next_run_at.asc())
        )
        result = await self.db.exec(statement)
        return result.all()

    async def update_schedule(
        self,
        schedule: ScheduledWorkflow,
        interval_seconds: int | None = None,
        start_at: datetime | None = None,
        is_active: bool | None = None,
    ) -> ScheduledWorkflow:
        """
        Update an existing schedule.

        Note: Can update interval, start_at, and is_active status.
        """
        recalculate_next_run = False

        if interval_seconds is not None:
            schedule.interval_seconds = interval_seconds
            recalculate_next_run = True

        if start_at is not None:
            schedule.start_at = start_at
            recalculate_next_run = True

        if is_active is not None:
            schedule.is_active = is_active

        # Recalculate next run time if interval changed
        if recalculate_next_run:
            schedule.next_run_at = self._calculate_next_run(
                datetime.now(), schedule.interval_seconds, 
                start_at=schedule.start_at, last_run_at=schedule.last_run_at
            )

        await self.db.commit()
        await self.db.refresh(schedule)

        logger.info(
            f"Updated schedule {schedule.id} for workflow {schedule.workflow_id}"
        )

        return schedule

    async def delete_schedule(self, schedule: ScheduledWorkflow) -> None:
        """Delete a schedule and reset workflow trigger_type to None (manual-only)."""
        workflow_id = schedule.workflow_id

        # Get workflow and reset trigger_type to None (no automatic triggers)
        workflow = await self.db.get(Workflow, workflow_id)
        if workflow:
            workflow.trigger_type = None
            self.db.add(workflow)

        await self.db.delete(schedule)
        await self.db.commit()
        logger.info(
            f"Deleted schedule for workflow {workflow_id}, trigger_type reset to None (manual-only)"
        )

    async def get_schedules_due_for_execution(
        self, look_ahead_seconds: int = 60
    ) -> list[ScheduledWorkflow]:
        """
        Get schedules that are due for execution within the look-ahead window.

        Args:
            look_ahead_seconds: How many seconds ahead to look for due schedules

        Returns:
            List of schedules due for execution
        """
        now = datetime.now()
        window = now + timedelta(seconds=look_ahead_seconds)

        statement = (
            select(ScheduledWorkflow)
            .where(
                ScheduledWorkflow.is_active,
                ScheduledWorkflow.next_run_at <= window,
            )
            .order_by(ScheduledWorkflow.next_run_at.asc())
        )

        result = await self.db.exec(statement)
        return result.all()

    async def update_schedule_after_execution(
        self,
        schedule: ScheduledWorkflow,
        success: bool,
        error_message: str | None = None,
    ) -> None:
        """
        Update schedule after an execution attempt.

        Args:
            schedule: The schedule that was executed
            success: Whether the execution was successful
            error_message: Error message if execution failed
        """
        schedule.last_run_at = datetime.now()
        schedule.run_count += 1

        if success:
            schedule.failure_count = 0
            schedule.last_error = None
        else:
            schedule.failure_count += 1
            schedule.last_error = error_message

            # Disable schedule after 5 consecutive failures
            if schedule.failure_count >= 5:
                schedule.is_active = False
                logger.warning(
                    f"Disabled schedule {schedule.id} after {schedule.failure_count} consecutive failures"
                )

        # Calculate next run time
        schedule.next_run_at = self._calculate_next_run(
            datetime.now(), schedule.interval_seconds,
            start_at=schedule.start_at, last_run_at=schedule.last_run_at
        )

        await self.db.commit()
        await self.db.refresh(schedule)

    def _calculate_next_run(
        self, from_time: datetime, interval_seconds: int, start_at: datetime | None = None, last_run_at: datetime | None = None
    ) -> datetime:
        """Calculate next run time.
        
        Simple logic:
        - First run: use start_at if in future, otherwise run now
        - Subsequent runs: add interval to current time
        """
        # First run
        if last_run_at is None and start_at and start_at > from_time:
            return start_at
        
        # Run now (first run with past start_at) or subsequent run
        return from_time + timedelta(seconds=interval_seconds)

    def _has_trigger_node(self, workflow_data: dict) -> bool:
        """
        Check if workflow has at least one trigger node.

        A trigger node is the entry point for automatic workflow execution.
        It must have type='trigger' and trigger=True.

        Args:
            workflow_data: The workflow definition containing nodes and edges

        Returns:
            True if workflow has a trigger node, False otherwise
        """
        nodes = workflow_data.get("nodes", [])
        for node in nodes:
            if node.get("type") == "trigger" and node.get("trigger") is True:
                return True
        return False
