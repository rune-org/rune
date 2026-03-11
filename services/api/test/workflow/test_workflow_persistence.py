"""Service-level persistence tests for workflow versioning."""

import pytest
from sqlmodel import select

from src.db.models import Workflow, WorkflowVersion


class TestWorkflowVersionPersistence:
    @pytest.mark.asyncio
    async def test_create_shell_persists_without_versions(
        self, workflow_service, test_user, test_db
    ):
        workflow = await workflow_service.create(
            user_id=test_user.id,
            name="Shell",
            description="No versions yet",
        )

        result = await test_db.exec(select(Workflow).where(Workflow.id == workflow.id))
        persisted = result.first()

        assert persisted.latest_version_id is None
        assert persisted.published_version_id is None
        assert persisted.is_active is False

    @pytest.mark.asyncio
    async def test_publish_persists_pointer_and_active_flag(
        self, workflow_service, sample_workflow, test_db
    ):
        latest = await workflow_service.get_latest_version(sample_workflow)
        await workflow_service.publish_version(sample_workflow, latest.id)

        await test_db.refresh(sample_workflow)
        assert sample_workflow.published_version_id == latest.id
        assert sample_workflow.is_active is True

    @pytest.mark.asyncio
    async def test_update_status_false_clears_published_pointer(
        self, workflow_service, sample_workflow, test_db
    ):
        latest = await workflow_service.get_latest_version(sample_workflow)
        await workflow_service.publish_version(sample_workflow, latest.id)

        await workflow_service.update_status(sample_workflow, False)

        await test_db.refresh(sample_workflow)
        assert sample_workflow.published_version_id is None
        assert sample_workflow.is_active is False

    @pytest.mark.asyncio
    async def test_restore_creates_new_row_with_copied_workflow_data(
        self, workflow_service, sample_workflow, test_user, test_db
    ):
        latest = await workflow_service.get_latest_version(sample_workflow)
        restored = await workflow_service.restore_version(
            workflow=sample_workflow,
            source_version_id=latest.id,
            user_id=test_user.id,
            message=None,
        )

        result = await test_db.exec(
            select(WorkflowVersion).where(WorkflowVersion.id == restored.id)
        )
        persisted = result.first()

        assert persisted.id != latest.id
        assert persisted.version == latest.version + 1
        assert persisted.workflow_data == latest.workflow_data
