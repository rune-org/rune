"""Service for managing schedule triggers on workflows."""

from datetime import datetime, timedelta
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import ScheduledWorkflow, Workflow, TriggerType
from src.core.exceptions import NotFound, BadRequest


class ScheduleTriggerService:
    """Service for managing schedule trigger operations on workflows."""

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
        Create a new schedule trigger for a workflow.

        Args:
            workflow_id: ID of the workflow to schedule
            interval_seconds: Interval in seconds between executions
            start_at: When to start (defaults to now)
            is_active: Whether the schedule is active

        Returns:
            The created ScheduledWorkflow instance

        Raises:
            NotFound: If workflow doesn't exist
            BadRequest: If workflow doesn't have trigger node or schedule already exists
        """
        # Verify workflow exists
        workflow = await self.db.get(Workflow, workflow_id)
        if not workflow:
            raise NotFound(detail="Workflow not found")

        # Validate workflow has a trigger node
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

        if start_at is None:
            start_at = datetime.now()

        # Calculate next run time
        next_run_at = self._calculate_next_run(start_at, interval_seconds)

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

        return schedule

    async def get_schedule(self, workflow_id: int) -> ScheduledWorkflow | None:
        """
        Get schedule for a specific workflow.

        Args:
            workflow_id: ID of the workflow

        Returns:
            ScheduledWorkflow if exists, None otherwise
        """
        statement = select(ScheduledWorkflow).where(
            ScheduledWorkflow.workflow_id == workflow_id
        )
        result = await self.db.exec(statement)
        return result.first()

    async def update_schedule(
        self,
        schedule: ScheduledWorkflow,
        interval_seconds: int | None = None,
        start_at: datetime | None = None,
        is_active: bool | None = None,
    ) -> ScheduledWorkflow:
        """
        Update an existing schedule trigger.

        Args:
            schedule: The schedule to update
            interval_seconds: New interval (optional)
            start_at: New start time (optional)
            is_active: New active status (optional)

        Returns:
            Updated ScheduledWorkflow instance
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

        # Recalculate next run time if interval or start time changed
        if recalculate_next_run:
            schedule.next_run_at = self._calculate_next_run(
                datetime.now(), schedule.interval_seconds
            )

        await self.db.commit()
        await self.db.refresh(schedule)

        return schedule

    async def delete_schedule(self, schedule: ScheduledWorkflow) -> None:
        """
        Delete a schedule trigger and reset workflow trigger_type to manual.

        Args:
            schedule: The schedule to delete
        """
        workflow_id = schedule.workflow_id

        # Get workflow and reset trigger_type to manual
        workflow = await self.db.get(Workflow, workflow_id)
        if workflow:
            workflow.trigger_type = TriggerType.MANUAL
            self.db.add(workflow)

        await self.db.delete(schedule)
        await self.db.commit()

    def _calculate_next_run(
        self, from_time: datetime, interval_seconds: int
    ) -> datetime:
        """Calculate the next run time based on interval in seconds."""
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
