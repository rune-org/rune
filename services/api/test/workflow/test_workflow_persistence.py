"""Database persistence and transaction tests for workflows."""

from datetime import datetime

import pytest
from sqlmodel import select

from src.db.models import ScheduledWorkflow, Workflow, WorkflowUser


class TestDatabasePersistence:
    """Tests for workflow data persistence."""

    @pytest.mark.asyncio
    async def test_workflow_name_update_persists(
        self, workflow_service, sample_workflow, test_db
    ):
        """Should persist name updates to database."""
        updated = await workflow_service.update_name(sample_workflow, "Updated Name")

        workflow_id = updated.id

        result = await test_db.exec(select(Workflow).where(Workflow.id == workflow_id))
        persisted = result.first()

        assert persisted.name == "Updated Name"

    @pytest.mark.asyncio
    async def test_workflow_trigger_type_persists(
        self, workflow_service, sample_workflow, test_db
    ):
        """Should persist trigger type from workflow data."""
        from src.db.models import TriggerType

        result = await test_db.exec(
            select(Workflow).where(Workflow.id == sample_workflow.id)
        )
        persisted = result.first()

        assert persisted.trigger_type == TriggerType.MANUAL

    @pytest.mark.asyncio
    async def test_workflow_data_persists_unchanged(
        self, workflow_service, test_user, test_db, sample_workflow_data
    ):
        """Should preserve workflow_data exactly as provided."""
        wf = await workflow_service.create(
            user_id=test_user.id,
            name="Complex Data",
            description="",
            workflow_data=sample_workflow_data,
        )

        result = await test_db.exec(select(Workflow).where(Workflow.id == wf.id))
        persisted = result.first()

        assert persisted.workflow_data == sample_workflow_data

    @pytest.mark.asyncio
    async def test_deletion_removes_from_database(
        self, workflow_service, sample_workflow, test_db
    ):
        """Should remove workflow from database on deletion."""
        workflow_id = sample_workflow.id

        await workflow_service.delete(sample_workflow)

        result = await test_db.exec(select(Workflow).where(Workflow.id == workflow_id))
        deleted = result.first()

        assert deleted is None

    @pytest.mark.asyncio
    async def test_multiple_workflows_maintain_isolation(
        self, workflow_service, test_user, test_db
    ):
        """Should maintain separate records for multiple workflows."""
        await workflow_service.create(test_user.id, "WF1", "", {})
        await workflow_service.create(test_user.id, "WF2", "", {})

        result = await test_db.exec(select(Workflow))
        all_workflows = result.all()

        assert len(all_workflows) >= 2

        names = [w.name for w in all_workflows]
        assert "WF1" in names
        assert "WF2" in names

    @pytest.mark.asyncio
    async def test_update_workflow_data_updates_scheduled_start_at(
        self, workflow_service, test_user, test_db
    ):
        """Should persist edited schedule start times and recompute next run."""
        workflow_data = {
            "nodes": [
                {
                    "id": "schedule-1",
                    "type": "ScheduleTrigger",
                    "trigger": True,
                    "parameters": {
                        "interval_seconds": 300,
                        "start_at": "2026-03-10T10:00:00Z",
                        "is_active": True,
                    },
                }
            ],
            "edges": [],
        }
        wf = await workflow_service.create(
            user_id=test_user.id,
            name="Scheduled Workflow",
            description="",
            workflow_data=workflow_data,
        )

        updated_workflow_data = {
            "nodes": [
                {
                    "id": "schedule-1",
                    "type": "ScheduleTrigger",
                    "trigger": True,
                    "parameters": {
                        "interval_seconds": 300,
                        "start_at": "2099-03-10T12:00:00Z",
                        "is_active": True,
                    },
                }
            ],
            "edges": [],
        }

        await workflow_service.update_workflow_data(wf, updated_workflow_data)

        result = await test_db.exec(
            select(ScheduledWorkflow).where(ScheduledWorkflow.workflow_id == wf.id)
        )
        persisted = result.first()

        assert persisted is not None
        assert persisted.start_at == datetime(2099, 3, 10, 12, 0)
        assert persisted.next_run_at == datetime(2099, 3, 10, 12, 0)

    @pytest.mark.asyncio
    async def test_toggle_schedule_updates_workflow_data(
        self, workflow_service, test_user, test_db
    ):
        """Should keep workflow_data in sync with schedule toggles."""
        workflow_data = {
            "nodes": [
                {
                    "id": "schedule-1",
                    "type": "ScheduleTrigger",
                    "trigger": True,
                    "parameters": {
                        "interval_seconds": 300,
                        "start_at": "2026-03-10T10:00:00Z",
                        "is_active": True,
                    },
                }
            ],
            "edges": [],
        }
        wf = await workflow_service.create(
            user_id=test_user.id,
            name="Scheduled Workflow",
            description="",
            workflow_data=workflow_data,
        )

        is_active = await workflow_service.toggle_schedule(wf)

        result = await test_db.exec(select(Workflow).where(Workflow.id == wf.id))
        persisted = result.first()

        assert is_active is False
        assert persisted is not None
        assert persisted.workflow_data["nodes"][0]["parameters"]["is_active"] is False

    @pytest.mark.asyncio
    async def test_create_scheduled_workflow_normalizes_offset_start_at(
        self, workflow_service, test_user, test_db
    ):
        """Should convert offset-aware datetimes to naive UTC before persisting."""
        workflow_data = {
            "nodes": [
                {
                    "id": "schedule-1",
                    "type": "ScheduleTrigger",
                    "trigger": True,
                    "parameters": {
                        "interval_seconds": 300,
                        "start_at": "2026-03-10T10:00:00+02:00",
                        "is_active": True,
                    },
                }
            ],
            "edges": [],
        }

        wf = await workflow_service.create(
            user_id=test_user.id,
            name="Scheduled Workflow",
            description="",
            workflow_data=workflow_data,
        )

        result = await test_db.exec(
            select(ScheduledWorkflow).where(ScheduledWorkflow.workflow_id == wf.id)
        )
        persisted = result.first()

        assert persisted is not None
        assert persisted.start_at == datetime(2026, 3, 10, 8, 0)


class TestWorkflowPermissions:
    """Tests for workflow permission management."""

    @pytest.mark.asyncio
    async def test_workflow_has_permissions(self, test_db, sample_workflow):
        """Should verify workflow has permissions."""
        # Query workflow permissions
        result = await test_db.exec(
            select(WorkflowUser).where(WorkflowUser.workflow_id == sample_workflow.id)
        )
        permissions = result.all()

        # check at least one user has permission
        assert len(permissions) >= 1

    @pytest.mark.asyncio
    async def test_specific_user_has_permission(
        self, test_db, sample_workflow, test_user
    ):
        """Should verify a specific user has permission to a specified workflow."""
        # Query workflow permissions
        result = await test_db.exec(
            select(WorkflowUser).where(WorkflowUser.workflow_id == sample_workflow.id)
        )
        permissions = result.all()

        # check a user has permission
        assert any(wfu.user_id == test_user.id for wfu in permissions)

    @pytest.mark.asyncio
    async def test_list_all_permissions_for_user(
        self, test_db, test_user, sample_workflow
    ):
        """Should list all permissions for a user."""
        result = await test_db.exec(
            select(WorkflowUser).where(WorkflowUser.user_id == test_user.id)
        )
        permissions = result.all()

        # User should have at least one permission (from sample_workflow)
        assert len(permissions) >= 1

    @pytest.mark.asyncio
    async def test_cascade_delete_removes_permissions(
        self, workflow_service, test_db, sample_workflow, other_user
    ):
        """Should cascade delete permissions when workflow deleted."""
        # Grant permission to other user
        workflow_id = sample_workflow.id

        # Delete workflow
        await workflow_service.delete(sample_workflow)

        # Verify permissions cascade deleted
        result = await test_db.exec(
            select(WorkflowUser).where(WorkflowUser.workflow_id == workflow_id)
        )
        permissions = result.all()

        assert len(permissions) == 0
