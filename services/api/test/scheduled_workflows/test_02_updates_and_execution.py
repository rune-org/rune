"""Tests for schedule updates and execution tracking."""

import pytest
from datetime import datetime, timedelta

from src.db.models import Workflow
from src.scheduler.service import ScheduledWorkflowService


class TestScheduleUpdates:
    """Tests for updating scheduled workflows (< 1 sec each)."""

    @pytest.mark.asyncio
    async def test_update_schedule_interval(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should update the interval of an active schedule."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
        )

        updated = await scheduled_workflow_service.update_schedule(
            schedule=schedule,
            interval_seconds=600,
        )

        assert updated.interval_seconds == 600

    @pytest.mark.asyncio
    async def test_deactivate_schedule(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should deactivate an active schedule."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
        )

        # Deactivate via model update
        schedule.is_active = False
        updated = await scheduled_workflow_service.update_schedule(schedule)

        assert updated.is_active is False

    @pytest.mark.asyncio
    async def test_delete_schedule(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should delete a schedule."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
        )

        await scheduled_workflow_service.delete_schedule(schedule)

        retrieved = await scheduled_workflow_service.get_schedule_by_workflow_id(
            workflow_with_trigger.id
        )
        assert retrieved is None

    @pytest.mark.asyncio
    async def test_update_start_time(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should update the start time of a schedule."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
        )

        new_start = datetime.now() + timedelta(hours=1)
        updated = await scheduled_workflow_service.update_schedule(
            schedule=schedule,
            start_at=new_start,
        )

        assert updated.start_at >= new_start

    @pytest.mark.asyncio
    async def test_reactivate_schedule(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should reactivate a deactivated schedule."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
            is_active=False,
        )

        schedule.is_active = True
        updated = await scheduled_workflow_service.update_schedule(schedule)

        assert updated.is_active is True


class TestScheduleExecutionTracking:
    """Tests for execution tracking (< 1 sec each)."""

    @pytest.mark.asyncio
    async def test_run_count_increments(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should increment run_count after successful execution."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
        )
        assert schedule.run_count == 0

        await scheduled_workflow_service.update_schedule_after_execution(
            schedule=schedule,
            success=True,
        )

        updated = await scheduled_workflow_service.get_schedule_by_id(schedule.id)
        assert updated.run_count == 1

    @pytest.mark.asyncio
    async def test_last_run_at_updates(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should update last_run_at after execution."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
        )
        assert schedule.last_run_at is None

        before = datetime.now()
        await scheduled_workflow_service.update_schedule_after_execution(
            schedule=schedule,
            success=True,
        )
        after = datetime.now()

        updated = await scheduled_workflow_service.get_schedule_by_id(schedule.id)
        assert updated.last_run_at is not None
        assert before <= updated.last_run_at <= after

    @pytest.mark.asyncio
    async def test_next_run_at_calculation(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should recalculate next_run_at after execution."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
        )

        before_next = schedule.next_run_at

        await scheduled_workflow_service.update_schedule_after_execution(
            schedule=schedule,
            success=True,
        )

        updated = await scheduled_workflow_service.get_schedule_by_id(schedule.id)
        # Next run should be in the future, approx 300 seconds from now
        assert updated.next_run_at > before_next

    @pytest.mark.asyncio
    async def test_failure_count_on_error(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should increment failure count and store error message on failure."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
        )

        await scheduled_workflow_service.update_schedule_after_execution(
            schedule=schedule,
            success=False,
            error_message="Network timeout",
        )

        updated = await scheduled_workflow_service.get_schedule_by_id(schedule.id)
        assert updated.failure_count == 1
        assert updated.last_error == "Network timeout"

    @pytest.mark.asyncio
    async def test_consecutive_failures_disable_schedule(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should disable schedule after 5 consecutive failures."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
        )

        # 5 consecutive failures
        for i in range(5):
            await scheduled_workflow_service.update_schedule_after_execution(
                schedule=schedule,
                success=False,
                error_message=f"Failure {i + 1}",
            )

            schedule = await scheduled_workflow_service.get_schedule_by_id(schedule.id)

        assert schedule.failure_count == 5
        assert schedule.is_active is False

    @pytest.mark.asyncio
    async def test_failure_count_resets_on_success(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should reset failure_count to 0 on successful execution."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
        )

        # Create 2 failures
        for _ in range(2):
            await scheduled_workflow_service.update_schedule_after_execution(
                schedule=schedule,
                success=False,
                error_message="Test failure",
            )

        schedule = await scheduled_workflow_service.get_schedule_by_id(schedule.id)
        assert schedule.failure_count == 2

        # Now succeed
        await scheduled_workflow_service.update_schedule_after_execution(
            schedule=schedule,
            success=True,
        )

        updated = await scheduled_workflow_service.get_schedule_by_id(schedule.id)
        assert updated.failure_count == 0
        assert updated.last_error is None
