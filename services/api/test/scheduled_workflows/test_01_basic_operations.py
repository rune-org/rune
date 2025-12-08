"""Fast tests for schedule creation and retrieval."""

import pytest
from datetime import datetime, timedelta

from src.db.models import Workflow
from src.scheduler.service import ScheduledWorkflowService


class TestScheduleCreation:
    """Tests for creating scheduled workflows (< 1 sec each)."""

    @pytest.mark.asyncio
    async def test_create_schedule_basic(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should create a basic schedule with default settings."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
        )

        assert schedule.id is not None
        assert schedule.workflow_id == workflow_with_trigger.id
        assert schedule.interval_seconds == 300
        assert schedule.is_active is True
        assert schedule.run_count == 0

    @pytest.mark.asyncio
    async def test_create_schedule_with_custom_start_time(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should create a schedule with custom start time."""
        start_time = datetime.now() + timedelta(minutes=5)

        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=600,
            start_at=start_time,
        )

        assert schedule.start_at >= start_time

    @pytest.mark.asyncio
    async def test_create_inactive_schedule(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should create an inactive schedule."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
            is_active=False,
        )

        assert schedule.is_active is False

    @pytest.mark.asyncio
    async def test_create_schedule_small_interval(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should allow small intervals."""
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=1,
        )

        assert schedule.interval_seconds == 1

    @pytest.mark.asyncio
    async def test_create_schedule_large_interval(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should allow large intervals."""
        one_year = 365 * 24 * 60 * 60
        schedule = await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=one_year,
        )

        assert schedule.interval_seconds == one_year


class TestScheduleRetrieval:
    """Tests for retrieving schedules (< 1 sec each)."""

    @pytest.mark.asyncio
    async def test_get_schedule_by_workflow_id(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        workflow_with_trigger: Workflow,
    ):
        """Should retrieve schedule by workflow ID."""
        await scheduled_workflow_service.create_schedule(
            workflow_id=workflow_with_trigger.id,
            interval_seconds=300,
        )

        schedule = await scheduled_workflow_service.get_schedule_by_workflow_id(
            workflow_with_trigger.id
        )

        assert schedule is not None
        assert schedule.workflow_id == workflow_with_trigger.id

    @pytest.mark.asyncio
    async def test_get_nonexistent_schedule(
        self, scheduled_workflow_service: ScheduledWorkflowService
    ):
        """Should return None for non-existent schedule."""
        schedule = await scheduled_workflow_service.get_schedule_by_workflow_id(99999)
        assert schedule is None

    @pytest.mark.asyncio
    async def test_list_all_schedules(
        self,
        scheduled_workflow_service: ScheduledWorkflowService,
        multiple_workflows_with_triggers: list[Workflow],
    ):
        """Should list all created schedules."""
        for workflow in multiple_workflows_with_triggers:
            await scheduled_workflow_service.create_schedule(
                workflow_id=workflow.id,
                interval_seconds=300,
            )

        schedules = await scheduled_workflow_service.list_all_schedules()
        assert len(schedules) >= 3
