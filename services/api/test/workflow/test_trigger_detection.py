"""Tests for automatic trigger type detection in workflow API."""

import pytest

from src.db.models import TriggerType
from src.workflow.service import WorkflowService
from src.workflow.triggers import ScheduleTriggerService


class TestTriggerTypeDetection:
    """Tests for automatic detection of trigger types from workflow_data."""

    @pytest.mark.asyncio
    async def test_detect_scheduled_trigger_from_workflow_data(
        self,
        workflow_service: WorkflowService,
        schedule_trigger_service: ScheduleTriggerService,
        test_user,
    ):
        """Should automatically detect scheduled trigger and create schedule."""
        workflow_data = {
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "trigger": True,
                    "data": {
                        "label": "Schedule Trigger",
                        "schedule": {
                            "interval_seconds": 3600,
                            "is_active": True,
                        },
                    },
                },
                {
                    "id": "action-1",
                    "type": "action",
                    "data": {"label": "Action"},
                },
            ],
            "edges": [{"src": "trigger-1", "dst": "action-1"}],
        }

        workflow = await workflow_service.create(
            user_id=test_user.id,
            name="Auto-scheduled Workflow",
            description="Should auto-detect schedule trigger",
            workflow_data=workflow_data,
        )

        # Verify trigger_type was set automatically
        assert workflow.trigger_type == TriggerType.SCHEDULED

        # Verify schedule was created
        schedule = await schedule_trigger_service.get_schedule(workflow.id)
        assert schedule is not None
        assert schedule.interval_seconds == 3600
        assert schedule.is_active is True

    @pytest.mark.asyncio
    async def test_detect_webhook_trigger_from_workflow_data(
        self,
        workflow_service: WorkflowService,
        schedule_trigger_service: ScheduleTriggerService,
        test_user,
    ):
        """Should automatically detect webhook trigger."""
        workflow_data = {
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "trigger": True,
                    "data": {
                        "label": "Webhook Trigger",
                        "webhook": {
                            "method": "POST",
                            "path": "/webhook/test",
                        },
                    },
                },
                {
                    "id": "action-1",
                    "type": "action",
                    "data": {"label": "Action"},
                },
            ],
            "edges": [{"src": "trigger-1", "dst": "action-1"}],
        }

        workflow = await workflow_service.create(
            user_id=test_user.id,
            name="Auto-webhook Workflow",
            description="Should auto-detect webhook trigger",
            workflow_data=workflow_data,
        )

        # Verify trigger_type was set automatically
        assert workflow.trigger_type == TriggerType.WEBHOOK

        # Webhook workflows should not have a schedule
        schedule = await schedule_trigger_service.get_schedule(workflow.id)
        assert schedule is None

    @pytest.mark.asyncio
    async def test_detect_manual_trigger_when_no_config(
        self,
        workflow_service: WorkflowService,
        schedule_trigger_service: ScheduleTriggerService,
        test_user,
    ):
        """Should default to manual (None) trigger when no schedule/webhook config."""
        workflow_data = {
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "trigger": True,
                    "data": {"label": "Manual Trigger"},
                },
                {
                    "id": "action-1",
                    "type": "action",
                    "data": {"label": "Action"},
                },
            ],
            "edges": [{"src": "trigger-1", "dst": "action-1"}],
        }

        workflow = await workflow_service.create(
            user_id=test_user.id,
            name="Manual Workflow",
            description="Should be manual trigger by default",
            workflow_data=workflow_data,
        )

        # Verify trigger_type defaults to None (manual)
        assert workflow.trigger_type is None

        # Manual workflows should not have a schedule
        schedule = await schedule_trigger_service.get_schedule(workflow.id)
        assert schedule is None

    @pytest.mark.asyncio
    async def test_update_workflow_adds_schedule_config(
        self,
        workflow_service: WorkflowService,
        schedule_trigger_service: ScheduleTriggerService,
        test_user,
    ):
        """Should create schedule when workflow_data is updated with schedule config."""
        # Start with manual workflow
        workflow_data = {
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "trigger": True,
                    "data": {"label": "Manual Trigger"},
                },
                {
                    "id": "action-1",
                    "type": "action",
                    "data": {"label": "Action"},
                },
            ],
            "edges": [{"src": "trigger-1", "dst": "action-1"}],
        }

        workflow = await workflow_service.create(
            user_id=test_user.id,
            name="Workflow to Schedule",
            description="Will be updated to scheduled",
            workflow_data=workflow_data,
        )

        assert workflow.trigger_type is None
        schedule = await schedule_trigger_service.get_schedule(workflow.id)
        assert schedule is None

        # Update with schedule config
        updated_workflow_data = {
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "trigger": True,
                    "data": {
                        "label": "Schedule Trigger",
                        "schedule": {
                            "interval_seconds": 7200,
                            "is_active": True,
                        },
                    },
                },
                {
                    "id": "action-1",
                    "type": "action",
                    "data": {"label": "Action"},
                },
            ],
            "edges": [{"src": "trigger-1", "dst": "action-1"}],
        }

        updated_workflow = await workflow_service.update_workflow_data(
            workflow=workflow,
            workflow_data=updated_workflow_data,
        )

        # Verify trigger_type changed to scheduled
        assert updated_workflow.trigger_type == TriggerType.SCHEDULED

        # Verify schedule was created
        schedule = await schedule_trigger_service.get_schedule(workflow.id)
        assert schedule is not None
        assert schedule.interval_seconds == 7200
        assert schedule.is_active is True

    @pytest.mark.asyncio
    async def test_update_workflow_removes_schedule_config(
        self,
        workflow_service: WorkflowService,
        schedule_trigger_service: ScheduleTriggerService,
        test_user,
    ):
        """Should delete schedule when schedule config is removed from workflow_data."""
        # Start with scheduled workflow
        workflow_data = {
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "trigger": True,
                    "data": {
                        "label": "Schedule Trigger",
                        "schedule": {
                            "interval_seconds": 1800,
                            "is_active": True,
                        },
                    },
                },
                {
                    "id": "action-1",
                    "type": "action",
                    "data": {"label": "Action"},
                },
            ],
            "edges": [{"src": "trigger-1", "dst": "action-1"}],
        }

        workflow = await workflow_service.create(
            user_id=test_user.id,
            name="Scheduled Workflow",
            description="Will have schedule removed",
            workflow_data=workflow_data,
        )

        assert workflow.trigger_type == TriggerType.SCHEDULED
        schedule = await schedule_trigger_service.get_schedule(workflow.id)
        assert schedule is not None

        # Remove schedule config
        updated_workflow_data = {
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "trigger": True,
                    "data": {"label": "Manual Trigger"},
                },
                {
                    "id": "action-1",
                    "type": "action",
                    "data": {"label": "Action"},
                },
            ],
            "edges": [{"src": "trigger-1", "dst": "action-1"}],
        }

        updated_workflow = await workflow_service.update_workflow_data(
            workflow=workflow,
            workflow_data=updated_workflow_data,
        )

        # Verify trigger_type changed to None (manual)
        assert updated_workflow.trigger_type is None

        # Verify schedule was deleted
        schedule = await schedule_trigger_service.get_schedule(workflow.id)
        assert schedule is None

    @pytest.mark.asyncio
    async def test_delete_workflow_cascades_to_schedule(
        self,
        workflow_service: WorkflowService,
        schedule_trigger_service: ScheduleTriggerService,
        test_user,
    ):
        """Should automatically delete schedule when workflow is deleted (CASCADE)."""
        # Create scheduled workflow
        workflow_data = {
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "trigger": True,
                    "data": {
                        "label": "Schedule Trigger",
                        "schedule": {
                            "interval_seconds": 3600,
                            "is_active": True,
                        },
                    },
                },
                {
                    "id": "action-1",
                    "type": "action",
                    "data": {"label": "Action"},
                },
            ],
            "edges": [{"src": "trigger-1", "dst": "action-1"}],
        }

        workflow = await workflow_service.create(
            user_id=test_user.id,
            name="Workflow to Delete",
            description="Will test cascade delete",
            workflow_data=workflow_data,
        )

        # Verify schedule exists
        schedule = await schedule_trigger_service.get_schedule(workflow.id)
        assert schedule is not None

        # Delete workflow
        await workflow_service.delete(workflow=workflow)

        # Verify schedule was automatically deleted
        schedule_after_delete = await schedule_trigger_service.get_schedule(workflow.id)
        assert schedule_after_delete is None
