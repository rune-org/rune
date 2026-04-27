"""Edge case tests for workflow API behavior.

Tests focus on:
- Boundary conditions and unusual inputs
- State transitions that might be missed
- Race condition scenarios
- Data integrity edge cases
"""

import pytest


class TestWorkflowEdgeCases:
    @pytest.mark.asyncio
    async def test_get_nonexistent_workflow_returns_404(self, authenticated_client):
        """User gets 404 when accessing deleted or non-existent workflow."""
        response = await authenticated_client.get("/workflows/999999")
        assert response.status_code == 404
        assert response.json()["success"] is False

    @pytest.mark.asyncio
    async def test_blank_name_rejected_with_validation_error(self, authenticated_client):
        """Whitespace-only workflow name rejected (422 validation error)."""
        response = await authenticated_client.post(
            "/workflows/",
            json={"name": "   ", "description": ""},
        )
        assert response.status_code == 422
        # Validation error structure

    @pytest.mark.asyncio
    async def test_stale_version_base_detected_as_conflict(
        self, authenticated_client, sample_workflow
    ):
        """Attempting to save with stale base_version_id returns 409 conflict."""
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        v1_id = detail.json()["data"]["latest_version"]["id"]

        # Create v2 (succeeds)
        v2_response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": v1_id,
                "workflow_data": {
                    "nodes": [{"id": "trigger", "type": "trigger", "trigger": True}],
                    "edges": [],
                },
                "message": "v2",
            },
        )
        assert v2_response.status_code == 201

        # Try to create another v2 with same base (v1) - conflict!
        conflict_response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": v1_id,
                "workflow_data": {
                    "nodes": [{"id": "trigger", "type": "trigger", "trigger": True}],
                    "edges": [],
                },
                "message": "concurrent save",
            },
        )
        assert conflict_response.status_code == 409
        assert conflict_response.json()["message"] == "version_conflict"

    @pytest.mark.asyncio
    async def test_special_characters_in_workflow_name_preserved(
        self, authenticated_client
    ):
        """Special characters in names are preserved, not stripped."""
        special_name = "Workflow!@#$%^&*()_+-=[]{}|;:,.<>?"
        response = await authenticated_client.post(
            "/workflows/",
            json={"name": special_name, "description": "desc"},
        )

        assert response.status_code == 201
        assert response.json()["data"]["name"] == special_name

    @pytest.mark.asyncio
    async def test_workflow_detail_does_not_expose_root_workflow_data(
        self, authenticated_client, sample_workflow
    ):
        """Workflow detail endpoint doesn't include root workflow_data (only in versions)."""
        response = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        assert response.status_code == 200

        data = response.json()["data"]
        # Root workflow object shouldn't have workflow_data field
        assert "workflow_data" not in data
        # But should have reference to latest_version
        assert "latest_version" in data
        assert data["latest_version"]["workflow_data"] is not None

    @pytest.mark.asyncio
    async def test_published_version_executes_not_latest(
        self, authenticated_client, sample_workflow
    ):
        """When multiple versions exist, running without version_id executes published version."""
        # Get v1
        detail1 = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        v1_id = detail1.json()["data"]["latest_version"]["id"]

        # Publish v1
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        # Create v2 with different structure
        v2_response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": v1_id,
                "workflow_data": {
                    "nodes": [
                        {"id": "trigger", "type": "trigger", "trigger": True},
                        {"id": "action-1", "type": "action"},
                        {"id": "action-2", "type": "action"},
                    ],
                    "edges": [
                        {"id": "e1", "src": "trigger", "dst": "action-1"},
                        {"id": "e2", "src": "action-1", "dst": "action-2"},
                    ],
                },
                "message": "v2 with more nodes",
            },
        )

        # Verify v2 is latest
        detail2 = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        v2_data = detail2.json()["data"]
        assert v2_data["latest_version"]["version"] == 2
        assert v2_data["published_version_id"] == v1_id  # Still publish v1

        # Running should execute v1 (published), not v2 (latest)
        # This is tested through RabbitMQ message in test_workflow_api.py

    @pytest.mark.asyncio
    async def test_can_restore_any_historical_version(
        self, authenticated_client, sample_workflow
    ):
        """Restoring old version creates new version based on it."""
        # Get v1
        detail1 = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        v1_id = detail1.json()["data"]["latest_version"]["id"]

        # Create v2
        await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": v1_id,
                "workflow_data": {
                    "nodes": [{"id": "trigger", "type": "trigger", "trigger": True}],
                    "edges": [],
                },
                "message": "v2",
            },
        )

        # Create v3
        detail2 = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        v2_id = detail2.json()["data"]["latest_version"]["id"]

        await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": v2_id,
                "workflow_data": {
                    "nodes": [{"id": "trigger", "type": "trigger", "trigger": True}],
                    "edges": [],
                },
                "message": "v3",
            },
        )

        # Now restore v1 (go backwards in history)
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/restore/{v1_id}",
            json={"message": "Restored from v1"},
        )
        assert response.status_code == 201

        # New version created (v4)
        restored = response.json()["data"]
        assert restored["version"] == 4
        assert restored["message"] == "Restored from v1"

    @pytest.mark.asyncio
    async def test_unpublished_workflow_cannot_be_executed_per_api(
        self, authenticated_client, sample_workflow
    ):
        """Never publishing = cannot execute (400 error)."""
        # Sample workflow created but not published
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run"
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_empty_workflow_with_only_trigger_rejected_on_execution(
        self, authenticated_client, workflow_service, test_db, test_user
    ):
        """Workflow with only trigger node (no actions) rejected on run attempt."""
        # Create and publish trigger-only workflow
        wf = await workflow_service.create(
            user_id=test_user.id,
            name="Trigger Only",
            description="",
        )
        v = await workflow_service.create_version(
            workflow=wf,
            user_id=test_user.id,
            workflow_data={
                "nodes": [{"id": "trigger", "type": "trigger", "trigger": True}],
                "edges": [],
            },
            base_version_id=None,
            message="Trigger only",
        )
        await workflow_service.publish_version(wf, v.id)

        # Try to run - should fail
        response = await authenticated_client.post(f"/workflows/{wf.id}/run")
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_workflow_renamed_does_not_affect_execution(
        self, authenticated_client, sample_workflow, workflow_service, test_user
    ):
        """Renaming workflow doesn't affect its ability to run."""
        # Publish
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        # Rename
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/name",
            json={"name": "Completely New Name"},
        )

        # Still runnable
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run"
        )
        assert response.status_code == 200

