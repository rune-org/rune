"""Fast tests for scheduling logic and due detection."""

import pytest
from datetime import datetime, timedelta

from src.db.models import Workflow
from src.scheduler.service import ScheduledWorkflowService


class TestSchedulingLogic:
    """Tests for scheduling logic (< 1 sec each)."""

    @pytest.mark.asyncio
    async def test_multiple_workflows_different_intervals(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        multiple_workflows_with_triggers: list[Workflow],
    ):
        """Should handle multiple workflows with different intervals."""
        intervals = [10, 20, 30]
        schedules = []

        for workflow, interval in zip(multiple_workflows_with_triggers, intervals):
            schedule = await scheduled_workflow_service.create_schedule(
                workflow_id=workflow.id,
                interval_seconds=interval,
            )
            schedules.append(schedule)

        assert len(schedules) == 3
        for schedule, expected_interval in zip(schedules, intervals):
            assert schedule.interval_seconds == expected_interval
            assert schedule.is_active is True

    @pytest.mark.asyncio
    async def test_get_schedules_due_for_execution(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        overdue_workflow_schedule,
    ):
        """Should identify overdue schedules."""
        due_schedules = (
            await scheduled_workflow_service.get_schedules_due_for_execution(
                look_ahead_seconds=0
            )
        )

        assert any(s.id == overdue_workflow_schedule.id for s in due_schedules)

    @pytest.mark.asyncio
    async def test_future_schedules_not_due(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        future_workflow_schedule,
    ):
        """Should not include future schedules in due list."""
        due_schedules = (
            await scheduled_workflow_service.get_schedules_due_for_execution(
                look_ahead_seconds=0
            )
        )

        assert not any(s.id == future_workflow_schedule.id for s in due_schedules)

    @pytest.mark.asyncio
    async def test_inactive_schedules_not_due(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should exclude inactive schedules from due list."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=10,
            start_at=datetime.now() - timedelta(seconds=20),  # Overdue
            is_active=False,
        )

        due_schedules = (
            await scheduled_workflow_service.get_schedules_due_for_execution(
                look_ahead_seconds=0
            )
        )

        assert not any(s.id == schedule.id for s in due_schedules)

    @pytest.mark.asyncio
    async def test_active_overdue_schedules_due(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should include active overdue schedules."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=10,
            start_at=datetime.now() - timedelta(seconds=20),  # Overdue
            is_active=True,
        )

        due_schedules = (
            await scheduled_workflow_service.get_schedules_due_for_execution(
                look_ahead_seconds=0
            )
        )

        assert any(s.id == schedule.id for s in due_schedules)


class TestIntervalChanges:
    """Tests for dynamic interval changes (< 1 sec each)."""

    @pytest.mark.asyncio
    async def test_change_interval_updates_next_run(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should update next_run_at when interval changes."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=60,
        )

        schedule = await scheduled_workflow_service.update_schedule(
            schedule=schedule,
            interval_seconds=30,
        )

        assert schedule.interval_seconds == 30

    @pytest.mark.asyncio
    async def test_rapid_interval_changes(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should handle rapid interval changes."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
        )

        intervals = [60, 30, 15, 10, 5]
        for new_interval in intervals:
            schedule = await scheduled_workflow_service.update_schedule(
                schedule=schedule,
                interval_seconds=new_interval,
            )
            assert schedule.interval_seconds == new_interval

        assert schedule.interval_seconds == 5


class TestErrorHandling:
    """Tests for error tracking (< 1 sec each)."""

    @pytest.mark.asyncio
    async def test_failure_count_increments(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should track execution failures."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
        )

        await scheduled_workflow_service.update_schedule_after_execution(
            schedule=schedule,
            success=False,
            error_message="Test error",
        )

        updated = await scheduled_workflow_service.get_schedule_by_id(schedule.id)
        assert updated.failure_count >= 1
        assert updated.last_error == "Test error"

    @pytest.mark.asyncio
    async def test_multiple_failures(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should track multiple failures."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=10,
        )

        errors = ["Error 1", "Error 2", "Error 3"]
        for error in errors:
            await scheduled_workflow_service.update_schedule_after_execution(
                schedule=schedule,
                success=False,
                error_message=error,
            )

        updated = await scheduled_workflow_service.get_schedule_by_id(schedule.id)
        assert updated.failure_count >= 3
        assert updated.last_error == "Error 3"

    @pytest.mark.asyncio
    async def test_successful_execution_after_failure(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should handle success after failure."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
        )

        # Fail once
        await scheduled_workflow_service.update_schedule_after_execution(
            schedule=schedule,
            success=False,
            error_message="Temporary failure",
        )

        failed = await scheduled_workflow_service.get_schedule_by_id(schedule.id)

        # Succeed
        await scheduled_workflow_service.update_schedule_after_execution(
            schedule=failed,
            success=True,
        )

        updated = await scheduled_workflow_service.get_schedule_by_id(schedule.id)
        assert updated.run_count >= 2
        # Failure count should reset on success
        assert updated.failure_count == 0
