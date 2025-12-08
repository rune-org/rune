"""Tests for multiple workflows running simultaneously with scheduling."""

import pytest
from datetime import datetime, timedelta

from src.db.models import Workflow
from src.scheduler.service import ScheduledWorkflowService


class TestMultipleWorkflowsExecution:
    """Tests for multiple workflows all scheduled and running (< 2 sec each)."""

    @pytest.mark.asyncio
    async def test_three_workflows_all_due_for_execution(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        multiple_workflows_with_triggers: list[Workflow],
    ):
        """Should detect all 3 workflows as due for execution simultaneously."""
        workflows = multiple_workflows_with_triggers
        now = datetime.now()
        schedules = []

        # Create schedules all set to be overdue
        for workflow in workflows:
            schedule = await scheduled_workflow_service.create_schedule(
                workflow_id=workflow.id,
                interval_seconds=60,
                start_at=now - timedelta(seconds=120),  # All overdue
            )
            schedules.append(schedule)

        # Verify all are detected as due
        due_schedules = (
            await scheduled_workflow_service.get_schedules_due_for_execution(
                look_ahead_seconds=0
            )
        )
        assert len(due_schedules) == len(workflows)
        assert all(s.id in [d.id for d in due_schedules] for s in schedules)

    @pytest.mark.asyncio
    async def test_four_workflows_mixed_execution_states(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        multiple_workflows_with_triggers: list[Workflow],
    ):
        """Should handle mixed execution states: overdue, due soon, future (uses 3 workflows)."""
        workflows = multiple_workflows_with_triggers
        now = datetime.now()
        schedules = []

        # Workflow 1: Overdue (30 sec interval, started 60 sec ago)
        s1 = await scheduled_workflow_service.create_schedule(
            workflow_id=workflows[0].id,
            interval_seconds=30,
            start_at=now - timedelta(seconds=60),
        )
        schedules.append(s1)

        # Workflow 2: Due in next 30 seconds (60 sec interval, started 40 sec ago)
        s2 = await scheduled_workflow_service.create_schedule(
            workflow_id=workflows[1].id,
            interval_seconds=60,
            start_at=now - timedelta(seconds=40),
        )
        schedules.append(s2)

        # Workflow 3: Not due (60 sec interval, started 10 sec ago)
        s3 = await scheduled_workflow_service.create_schedule(
            workflow_id=workflows[2].id,
            interval_seconds=60,
            start_at=now - timedelta(seconds=10),
        )
        schedules.append(s3)

        # Check due now (0 sec lookahead)
        due_now = await scheduled_workflow_service.get_schedules_due_for_execution(
            look_ahead_seconds=0
        )
        assert s1.id in [d.id for d in due_now], "Overdue workflow should be due"

        # Check due in next 30 seconds (30 sec lookahead)
        due_soon = await scheduled_workflow_service.get_schedules_due_for_execution(
            look_ahead_seconds=30
        )
        due_soon_ids = [d.id for d in due_soon]
        assert s1.id in due_soon_ids, "Overdue workflow should be in soon list"
        assert s2.id in due_soon_ids, "Due-soon workflow should be in soon list"
        assert s3.id not in due_soon_ids, "Future workflow should not be in soon list"

    @pytest.mark.asyncio
    async def test_five_workflows_all_execute_once(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        multiple_workflows_with_triggers: list[Workflow],
    ):
        """Should handle execution of 5 workflows (using 3 + 2 additional logic)."""
        workflows = multiple_workflows_with_triggers
        now = datetime.now()
        schedules = []

        # Create schedules for all workflows set to be overdue
        for workflow in workflows:
            schedule = await scheduled_workflow_service.create_schedule(
                workflow_id=workflow.id,
                interval_seconds=60,
                start_at=now - timedelta(seconds=120),  # All overdue
            )
            schedules.append(schedule)

        # Verify all are due
        due_schedules = (
            await scheduled_workflow_service.get_schedules_due_for_execution(
                look_ahead_seconds=0
            )
        )
        assert len(due_schedules) >= len(workflows)

        # Execute all once
        for schedule in schedules:
            await scheduled_workflow_service.update_schedule_after_execution(
                schedule=schedule,
                success=True,
            )

        # Verify all executed
        for schedule in schedules:
            updated = await scheduled_workflow_service.get_schedule_by_id(schedule.id)
            assert updated.run_count == 1
            assert updated.last_run_at is not None

    @pytest.mark.asyncio
    async def test_multiple_workflows_with_failures(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        multiple_workflows_with_triggers: list[Workflow],
    ):
        """Should handle partial failures across multiple workflows."""
        workflows = multiple_workflows_with_triggers
        now = datetime.now()
        schedules = []

        # Create schedules all overdue
        for workflow in workflows:
            schedule = await scheduled_workflow_service.create_schedule(
                workflow_id=workflow.id,
                interval_seconds=60,
                start_at=now - timedelta(seconds=120),
            )
            schedules.append(schedule)

        # Workflow 1: Success
        await scheduled_workflow_service.update_schedule_after_execution(
            schedule=schedules[0],
            success=True,
        )

        # Workflow 2: Failure
        await scheduled_workflow_service.update_schedule_after_execution(
            schedule=schedules[1],
            success=False,
            error_message="Network timeout",
        )

        # Workflow 3: Success
        await scheduled_workflow_service.update_schedule_after_execution(
            schedule=schedules[2],
            success=True,
        )

        # Verify individual states
        s0 = await scheduled_workflow_service.get_schedule_by_id(schedules[0].id)
        s1 = await scheduled_workflow_service.get_schedule_by_id(schedules[1].id)
        s2 = await scheduled_workflow_service.get_schedule_by_id(schedules[2].id)

        assert s0.run_count == 1
        assert s0.failure_count == 0

        assert s1.run_count == 1
        assert s1.failure_count == 1
        assert s1.last_error == "Network timeout"

        assert s2.run_count == 1
        assert s2.failure_count == 0

    @pytest.mark.asyncio
    async def test_multiple_workflows_rapid_sequential_execution(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        multiple_workflows_with_triggers: list[Workflow],
    ):
        """Should handle rapid sequential execution across multiple workflows."""
        workflows = multiple_workflows_with_triggers
        now = datetime.now()
        schedules = []

        # Create schedules
        for workflow in workflows:
            schedule = await scheduled_workflow_service.create_schedule(
                workflow_id=workflow.id,
                interval_seconds=60,
                start_at=now - timedelta(seconds=120),
            )
            schedules.append(schedule)

        # Each workflow executes 10 times rapidly
        for schedule in schedules:
            for _ in range(10):
                await scheduled_workflow_service.update_schedule_after_execution(
                    schedule=schedule,
                    success=True,
                )

        # Verify all executed 10 times
        for i, schedule in enumerate(schedules):
            updated = await scheduled_workflow_service.get_schedule_by_id(schedule.id)
            assert updated.run_count == 10, f"Workflow {i} should have run 10 times"
            assert updated.failure_count == 0

    @pytest.mark.asyncio
    async def test_multiple_workflows_different_intervals_get_due(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        multiple_workflows_with_triggers: list[Workflow],
    ):
        """Should detect multiple workflows with different intervals all due."""
        workflows = multiple_workflows_with_triggers
        now = datetime.now()
        schedules = []

        # Create schedules with different intervals but all overdue
        intervals = [30, 60, 90]
        for workflow, interval in zip(workflows, intervals):
            schedule = await scheduled_workflow_service.create_schedule(
                workflow_id=workflow.id,
                interval_seconds=interval,
                start_at=now - timedelta(seconds=interval + 10),  # All overdue
            )
            schedules.append(schedule)

        # All should be detected as due
        due_schedules = (
            await scheduled_workflow_service.get_schedules_due_for_execution(
                look_ahead_seconds=0
            )
        )
        due_ids = [d.id for d in due_schedules]

        for schedule in schedules:
            assert schedule.id in due_ids, (
                f"Schedule with {schedule.interval_seconds}s interval should be due"
            )

    @pytest.mark.asyncio
    async def test_multiple_workflows_state_isolation(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        multiple_workflows_with_triggers: list[Workflow],
    ):
        """Should maintain complete state isolation between workflows."""
        workflows = multiple_workflows_with_triggers

        # Create schedules for all
        schedules = []
        for workflow in workflows:
            schedule = await scheduled_workflow_service.create_schedule(
                workflow_id=workflow.id,
                interval_seconds=60,
            )
            schedules.append(schedule)

        # Execute first workflow 5 times
        for _ in range(5):
            await scheduled_workflow_service.update_schedule_after_execution(
                schedule=schedules[0],
                success=True,
            )

        # Execute second workflow 3 times
        for _ in range(3):
            await scheduled_workflow_service.update_schedule_after_execution(
                schedule=schedules[1],
                success=True,
            )

        # Third workflow not executed yet

        # Verify isolation
        s0 = await scheduled_workflow_service.get_schedule_by_id(schedules[0].id)
        s1 = await scheduled_workflow_service.get_schedule_by_id(schedules[1].id)
        s2 = await scheduled_workflow_service.get_schedule_by_id(schedules[2].id)

        assert s0.run_count == 5
        assert s1.run_count == 3
        assert s2.run_count == 0  # Not executed

        assert s0.last_run_at is not None
        assert s1.last_run_at is not None
        assert s2.last_run_at is None
