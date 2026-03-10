"""Service for managing schedule triggers on workflows."""

from datetime import datetime, timedelta

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.exceptions import BadRequest, NotFound
from src.db.models import ScheduledWorkflow, TriggerType, Workflow


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
        """Create a new schedule trigger for a workflow."""
        workflow = await self.db.get(Workflow, workflow_id)
        if not workflow:
            raise NotFound(detail="Workflow not found")

        if not self._has_trigger_node(workflow.workflow_data):
            raise BadRequest(
                detail="Workflow must have a trigger node to be scheduled."
            )

        # Check for existing schedule
        statement = select(ScheduledWorkflow).where(
            ScheduledWorkflow.workflow_id == workflow_id
        )
        result = await self.db.exec(statement)
        if result.first():
            raise BadRequest(
                detail="Schedule already exists for this workflow. Update or delete the existing schedule first."
            )

        if start_at is None:
            start_at = datetime.now()

        next_run_at = self._calculate_next_run(start_at, interval_seconds)

        schedule = ScheduledWorkflow(
            workflow_id=workflow_id,
            interval_seconds=interval_seconds,
            start_at=start_at,
            next_run_at=next_run_at,
            is_active=is_active,
        )
        self.db.add(schedule)

        workflow.trigger_type = TriggerType.SCHEDULED
        self.db.add(workflow)

        await self.db.commit()
        await self.db.refresh(schedule)
        return schedule

    async def get_schedule(self, workflow_id: int) -> ScheduledWorkflow | None:
        """Get schedule for a specific workflow."""
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
        """Update an existing schedule trigger."""
        recalculate = False

        if interval_seconds is not None:
            schedule.interval_seconds = interval_seconds
            recalculate = True
        if start_at is not None:
            schedule.start_at = start_at
            recalculate = True
        if is_active is not None:
            schedule.is_active = is_active

        if recalculate:
            schedule.next_run_at = self._calculate_next_run(
                datetime.now(), schedule.interval_seconds
            )

        await self.db.commit()
        await self.db.refresh(schedule)
        return schedule

    async def delete_schedule(self, schedule: ScheduledWorkflow) -> None:
        """Delete a schedule trigger and reset workflow trigger_type to manual."""
        workflow = await self.db.get(Workflow, schedule.workflow_id)
        if workflow:
            workflow.trigger_type = TriggerType.MANUAL
            self.db.add(workflow)

        await self.db.delete(schedule)
        await self.db.commit()

    def _calculate_next_run(
        self, from_time: datetime, interval_seconds: int
    ) -> datetime:
        """Calculate the next run time based on interval."""
        return from_time + timedelta(seconds=interval_seconds)

    def _has_trigger_node(self, workflow_data: dict) -> bool:
        """Check if workflow has at least one trigger node."""
        nodes = workflow_data.get("nodes", [])
        for node in nodes:
            if node.get("type") == "trigger" and node.get("trigger") is True:
                return True
        return False
