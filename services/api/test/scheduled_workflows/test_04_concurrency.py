"""Fast high-volume tests (< 2 sec total)."""

import pytest

from src.db.models import Workflow
from src.scheduler.service import ScheduledWorkflowService


class TestHighVolumeOperations:
    """Tests for high-volume sequential operations (optimized for speed)."""

    @pytest.mark.asyncio
    async def test_rapid_execution_updates(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should handle rapid execution updates (10 runs in <1 sec)."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=1,
        )

        # Rapid sequential updates (no async sleeps)
        for i in range(10):
            await scheduled_workflow_service.update_schedule_after_execution(
                schedule=schedule,
                success=True,
            )

        updated = await scheduled_workflow_service.get_schedule_by_id(schedule.id)
        assert updated.run_count == 10

    @pytest.mark.asyncio
    async def test_many_schedules_sequential(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        multiple_workflows_with_triggers: list[Workflow],
    ):
        """Should handle many schedules with sequential execution."""
        # Create schedules for each workflow
        schedules = []
        for workflow in multiple_workflows_with_triggers:
            schedule = await scheduled_workflow_service.create_schedule(
                workflow_id=workflow.id,
                interval_seconds=5,
            )
            schedules.append(schedule)

        # Execute each schedule 30 times
        for schedule in schedules:
            for _ in range(30):
                await scheduled_workflow_service.update_schedule_after_execution(
                    schedule=schedule,
                    success=True,
                )

        # Verify all updated correctly
        for i, schedule in enumerate(schedules):
            updated = await scheduled_workflow_service.get_schedule_by_id(schedule.id)
            assert updated.run_count == 30, (
                f"Schedule {i} has {updated.run_count} runs, expected 30"
            )

    @pytest.mark.asyncio
    async def test_mixed_success_failure_operations(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should track mixed success/failure in sequential operations."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=5,
        )

        # 20 mixed operations
        for i in range(20):
            success = i % 3 != 0  # Failures every 3rd operation
            await scheduled_workflow_service.update_schedule_after_execution(
                schedule=schedule,
                success=success,
                error_message="Test error" if not success else None,
            )

        updated = await scheduled_workflow_service.get_schedule_by_id(schedule.id)
        assert updated.run_count == 20
        # Failure count resets on each success, so we should have 0 or 1
        assert updated.failure_count <= 1

    @pytest.mark.asyncio
    async def test_rapid_create_and_execute(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        multiple_workflows_with_triggers: list[Workflow],
    ):
        """Should quickly create and execute multiple schedules (one per workflow)."""
        # Create one schedule per workflow and execute it 5 times
        for i, workflow in enumerate(multiple_workflows_with_triggers):
            schedule = await scheduled_workflow_service.create_schedule(
                workflow_id=workflow.id,
                interval_seconds=10,
            )

            # Execute it 5 times
            for _ in range(5):
                await scheduled_workflow_service.update_schedule_after_execution(
                    schedule=schedule,
                    success=True,
                )

            updated = await scheduled_workflow_service.get_schedule_by_id(schedule.id)
            assert updated.run_count == 5

    @pytest.mark.asyncio
    async def test_interval_updates_many_times(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should handle many interval updates sequentially."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=10,
        )

        # Update interval 15 times
        for i in range(1, 16):
            new_interval = 10 * (i + 1)
            updated = await scheduled_workflow_service.update_schedule(
                schedule=schedule,
                interval_seconds=new_interval,
            )
            schedule = updated

        final = await scheduled_workflow_service.get_schedule_by_id(schedule.id)
        assert final.interval_seconds == 10 * 16
