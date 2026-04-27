"""API endpoint tests for workflow versioning."""
"""Core API behavior tests for workflow execution and versioning.

These tests verify REAL USER INTERACTIONS:
- How workflows behave through the execution lifecycle
- Queue/message publishing for actual execution
- Version conflict detection during concurrent edits
- Execution with specific version pinning

Note: Permission tests, input validation, and basic state checks
are covered in test_workflow_permissions.py and test_workflow_input_validation.py
"""

import json

import pytest
from sqlmodel import select

from src.db.models import Execution, Workflow, WorkflowVersion
from src.workflow.queue import NO_ACTION_NODES_MESSAGE


class TestWorkflowVersionConflictDetection:
    """Test version conflict detection during concurrent concurrent edits."""

    @pytest.mark.asyncio
    async def test_version_conflict_detected_on_stale_base(
        self, authenticated_client, sample_workflow
    ):
        """Creating version with stale base_version_id returns 409."""
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        latest = detail.json()["data"]["latest_version"]

        # Create second version - succeeds
        second = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": latest["id"],
                "workflow_data": {
                    "nodes": [{"id": "node-1", "type": "trigger", "trigger": True}],
                    "edges": [],
                },
                "message": "v2",
            },
        )
        assert second.status_code == 201

        # Try to create another version with same base - conflicts (409)
        conflict = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": latest["id"],
                "workflow_data": {
                    "nodes": [{"id": "node-1", "type": "trigger", "trigger": True}],
                    "edges": [],
                },
                "message": "stale save",
            },
        )
        assert conflict.status_code == 409
        body = conflict.json()
        assert body["success"] is False
        assert body["message"] == "version_conflict"
        assert body["data"]["server_version"] == 2
        assert isinstance(body["data"]["server_version_id"], int)


class TestWorkflowVersionMetadata:
    """Test version listing and metadata retrieval."""

    @pytest.mark.asyncio
    async def test_list_versions_returns_metadata_without_workflow_data(
        self, authenticated_client, sample_workflow
    ):
        """List endpoint returns lightweight metadata, not full workflow_data."""
        response = await authenticated_client.get(
            f"/workflows/{sample_workflow.id}/versions"
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) >= 1
        # Lightweight response - no workflow_data to reduce bandwidth
        assert "workflow_data" not in data[0]
        assert data[0]["version"] >= 1
        assert "is_published" in data[0]

    @pytest.mark.asyncio
    async def test_get_specific_version_includes_full_workflow_data(
        self, authenticated_client, sample_workflow
    ):
        """Get endpoint returns full workflow_data for version."""
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        version_id = detail.json()["data"]["latest_version"]["id"]

        response = await authenticated_client.get(
            f"/workflows/{sample_workflow.id}/versions/{version_id}"
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["id"] == version_id
        # Full response includes workflow definition
        assert "workflow_data" in data
        assert "nodes" in data["workflow_data"]



class TestWorkflowExecution:
    """Test workflow execution and queue message publishing."""

    @pytest.mark.asyncio
    async def test_trigger_only_workflow_with_no_actions_rejected(
        self, authenticated_client, workflow_service, test_db, test_user
    ):
        """Attempting to run trigger-only workflow (no action nodes) returns 400."""
        workflow = await workflow_service.create(
            user_id=test_user.id,
            name="Trigger Only",
            description="",
        )
        version = await workflow_service.create_version(
            workflow=workflow,
            user_id=test_user.id,
            workflow_data={
                "nodes": [{"id": "trigger", "type": "trigger", "trigger": True}],
                "edges": [],
            },
            base_version_id=None,
            message="Initial trigger-only version",
        )
        await workflow_service.publish_version(workflow, version.id)

        # User attempts to run - gets 400 (invalid workflow structure)
        response = await authenticated_client.post(f"/workflows/{workflow.id}/run")
        assert response.status_code == 400
        assert response.json()["message"] == NO_ACTION_NODES_MESSAGE

        # No execution record created for invalid workflow
        executions = (
            await test_db.exec(
                select(Execution).where(Execution.workflow_id == workflow.id)
            )
        ).all()
        assert executions == []

    @pytest.mark.asyncio
    async def test_published_version_is_executed_by_default(
        self,
        authenticated_client,
        sample_workflow,
        test_rabbitmq,
        test_settings,
    ):
        """Running workflow without specifying version_id uses published version."""
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        published_version = detail.json()["data"]["latest_version"]

        # Publish it
        await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/publish",
            json={"version_id": published_version["id"]},
        )

        # Setup RabbitMQ queue listener
        channel = await test_rabbitmq.channel()
        queue = await channel.declare_queue(
            test_settings.rabbitmq_workflow_queue,
            durable=True,
        )
        await queue.purge()

        # Run without specifying version_id
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run"
        )
        assert response.status_code == 200

        # Verify message in queue contains published version details
        message = await queue.get(timeout=5)
        assert message is not None
        payload = json.loads(message.body.decode("utf-8"))
        assert payload["workflow_id"] == str(sample_workflow.id)
        assert payload["workflow_version"] == published_version["version"]
        assert payload["workflow_version_id"] == published_version["id"]

        await channel.close()

    @pytest.mark.asyncio
    async def test_specific_version_can_be_pinned_for_execution(
        self,
        authenticated_client,
        sample_workflow,
        test_rabbitmq,
        test_settings,
    ):
        """Running with version_id parameter executes specific version, not published."""
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        first_version = detail.json()["data"]["latest_version"]

        # Publish first version
        await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/publish",
            json={"version_id": first_version["id"]},
        )

        # Create second version with different structure
        second = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": first_version["id"],
                "workflow_data": {
                    "nodes": [
                        {"id": "node-1", "type": "trigger", "trigger": True},
                        {"id": "node-2", "type": "action"},
                        {"id": "node-3", "type": "action"},
                    ],
                    "edges": [
                        {"id": "edge-1", "src": "node-1", "dst": "node-2"},
                        {"id": "edge-2", "src": "node-2", "dst": "node-3"},
                    ],
                },
                "message": "Add branch",
            },
        )
        assert second.status_code == 201

        # Setup RabbitMQ queue
        channel = await test_rabbitmq.channel()
        queue = await channel.declare_queue(
            test_settings.rabbitmq_workflow_queue,
            durable=True,
        )
        await queue.purge()

        # Run with explicit version_id pointing to first version (not second)
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run",
            json={"version_id": first_version["id"]},
        )
        assert response.status_code == 200

        # Verify queue message has v1 structure (2 nodes), not v2 (3 nodes)
        message = await queue.get(timeout=5)
        assert message is not None
        payload = json.loads(message.body.decode("utf-8"))
        assert payload["workflow_version"] == 1
        assert payload["workflow_version_id"] == first_version["id"]
        assert len(payload["workflow_definition"]["nodes"]) == 2

        await channel.close()

    @pytest.mark.asyncio
    async def test_unpublished_workflow_cannot_be_executed(
        self,
        authenticated_client,
        client,
        test_user,
        workflow_service,
    ):
        """Workflow with no published version returns 400."""
        # Create workflow but don't publish
        workflow = await workflow_service.create(
            user_id=test_user.id,
            name="Unpublished Workflow",
            description="",
        )

        response = await authenticated_client.post(f"/workflows/{workflow.id}/run")
        assert response.status_code == 400


class TestWorkflowPublishing:
    """Test workflow publishing behavior."""

    @pytest.mark.asyncio
    async def test_cannot_publish_workflow_without_versions(
        self, authenticated_client
    ):
        """Publishing workflow shell (no versions) returns 400."""
        create_response = await authenticated_client.post(
            "/workflows/",
            json={"name": "Empty workflow", "description": ""},
        )
        workflow_id = create_response.json()["data"]["id"]

        response = await authenticated_client.put(
            f"/workflows/{workflow_id}/status",
            json={"is_active": True},
        )
        assert response.status_code == 400


class TestWorkflowAuthorization:
    """Test authorization checks on workflow operations.
    
    Note: Comprehensive permission tests are in test_workflow_permissions.py
    These tests focus on API-observable behavior like cross-user access prevention.
    """

    @pytest.mark.asyncio
    async def test_user_cannot_access_other_users_private_workflow(
        self, authenticated_client, other_client, workflow_service, other_user
    ):
        """User cannot access workflow owned by another user (403)."""
        other_workflow = await workflow_service.create(
            user_id=other_user.id,
            name="Other User Workflow",
            description="",
        )

        response = await other_client.get(f"/workflows/{other_workflow.id}")
        assert response.status_code == 403


class TestWorkflowDeletion:
    """Test workflow deletion behavior."""

    @pytest.mark.asyncio
    async def test_deleted_workflow_is_permanently_removed(
        self, authenticated_client, workflow_service, test_db, test_user
    ):
        """Deleted workflow cannot be retrieved (404)."""
        workflow = await workflow_service.create(
            user_id=test_user.id,
            name="To Delete",
            description="",
        )
        workflow_id = workflow.id

        # Delete it
        response = await authenticated_client.delete(f"/workflows/{workflow_id}")
        assert response.status_code == 204

        # Cannot retrieve deleted workflow
        get_response = await authenticated_client.get(f"/workflows/{workflow_id}")
        assert get_response.status_code == 404

        # Verify database record removed
        result = await test_db.exec(select(Workflow).where(Workflow.id == workflow_id))
        assert result.first() is None

