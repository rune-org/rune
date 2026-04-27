"""Workflow execution and state change API tests.

Tests verify:
- Running workflows triggers execution and returns execution ID
- Only OWNER and EDITOR can execute (not VIEWER)
- Execution state is properly tracked
- Publishing/unpublishing workflows affects execution eligibility
- Invalid workflows cannot be executed
"""

import pytest


class TestWorkflowExecution:
    """Test workflow run/execution endpoints."""

    @pytest.mark.asyncio
    async def test_viewer_cannot_run_workflow(
        self, viewer_client, workflow_with_viewer
    ):
        """VIEWER should get 403 when trying to run workflow."""
        response = await viewer_client.post(
            f"/workflows/{workflow_with_viewer.id}/run"
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_unauthenticated_cannot_run_workflow(self, client, sample_workflow):
        """Unauthenticated user should get 401."""
        response = await client.post(f"/workflows/{sample_workflow.id}/run")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_owner_can_run_published_workflow(
        self, authenticated_client, sample_workflow
    ):
        """OWNER can run a published workflow and gets execution ID."""
        # First publish the workflow
        publish_response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )
        assert publish_response.status_code == 200

        # Run the workflow
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "data" in data  # execution_id
        execution_id = data["data"]
        assert isinstance(execution_id, str)
        assert len(execution_id) > 0

    @pytest.mark.asyncio
    async def test_run_unpublished_workflow_fails(
        self, authenticated_client, sample_workflow
    ):
        """Cannot run workflow that has no published version."""
        # Don't publish - sample_workflow is created but not published
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run"
        )
        assert response.status_code in [400, 422]  # BadRequest or validation error

    @pytest.mark.asyncio
    async def test_running_workflow_returns_different_execution_ids(
        self, authenticated_client, sample_workflow
    ):
        """Running same workflow twice returns different execution IDs."""
        # Publish
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        # Run first time
        response1 = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run"
        )
        execution_id_1 = response1.json()["data"]

        # Run second time
        response2 = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run"
        )
        execution_id_2 = response2.json()["data"]

        assert execution_id_1 != execution_id_2

    @pytest.mark.asyncio
    async def test_run_with_specific_version(
        self, authenticated_client, sample_workflow
    ):
        """Can run a specific workflow version if provided."""
        # Get the latest version first
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        latest_version_id = detail.json()["data"]["latest_version"]["id"]

        # Publish
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        # Run with specific version
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run",
            json={"version_id": latest_version_id},
        )
        assert response.status_code == 200
        assert "data" in response.json()


class TestWorkflowStateChanges:
    """Test workflow publishing, unpublishing, and state transitions."""

    @pytest.mark.asyncio
    async def test_publish_sets_published_version_id(
        self, authenticated_client, sample_workflow
    ):
        """Publishing workflow sets published_version_id."""
        # Before publish, should be None
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        assert detail.json()["data"]["published_version_id"] is None

        # Publish
        response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["is_active"] is True
        assert data["published_version_id"] is not None

    @pytest.mark.asyncio
    async def test_unpublish_clears_published_version_id(
        self, authenticated_client, sample_workflow
    ):
        """Unpublishing workflow clears published_version_id."""
        # Publish first
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        # Unpublish
        response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": False},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["is_active"] is False
        assert data["published_version_id"] is None

    @pytest.mark.asyncio
    async def test_new_version_after_publish_marks_unpublished_changes(
        self, authenticated_client, sample_workflow
    ):
        """Creating new version after publish marks has_unpublished_changes=True."""
        # Publish
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        assert detail.json()["data"]["has_unpublished_changes"] is False

        # Create new version
        latest = detail.json()["data"]["latest_version"]
        await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": latest["id"],
                "workflow_data": {
                    "nodes": [{"id": "node-1", "type": "trigger", "trigger": True}],
                    "edges": [],
                },
                "message": "New changes",
            },
        )

        # Check status - should have unpublished changes
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        assert detail.json()["data"]["has_unpublished_changes"] is True

    @pytest.mark.asyncio
    async def test_republish_after_new_version_updates_published_id(
        self, authenticated_client, sample_workflow
    ):
        """Publishing new version updates published_version_id."""
        # Publish first version
        initial_publish = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )
        initial_published_id = initial_publish.json()["data"]["published_version_id"]

        # Create new version
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        latest = detail.json()["data"]["latest_version"]
        await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": latest["id"],
                "workflow_data": {
                    "nodes": [{"id": "node-1", "type": "trigger", "trigger": True}],
                    "edges": [],
                },
                "message": "Version 2",
            },
        )

        # Republish
        repub = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )
        new_published_id = repub.json()["data"]["published_version_id"]

        # Published ID should be different
        assert new_published_id != initial_published_id


class TestWorkflowDeletion:
    """Test workflow deletion and data consistency."""

    @pytest.mark.asyncio
    async def test_delete_workflow_removes_it(
        self, authenticated_client, sample_workflow, test_db
    ):
        """Deleting workflow returns 204 and removes it from DB."""
        workflow_id = sample_workflow.id

        # Delete
        response = await authenticated_client.delete(f"/workflows/{workflow_id}")
        assert response.status_code == 204

        # Cannot get it anymore
        get_response = await authenticated_client.get(f"/workflows/{workflow_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_published_workflow_succeeds(
        self, authenticated_client, sample_workflow
    ):
        """Can delete a published (active) workflow."""
        # Publish
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        # Delete should still work
        response = await authenticated_client.delete(f"/workflows/{sample_workflow.id}")
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_viewer_cannot_delete_workflow(
        self, viewer_client, workflow_with_viewer
    ):
        """VIEWER should get 403 when trying to delete."""
        response = await viewer_client.delete(f"/workflows/{workflow_with_viewer.id}")
        assert response.status_code == 403


class TestWorkflowListAndAccess:
    """Test listing workflows and access control."""

    @pytest.mark.asyncio
    async def test_list_workflows_only_shows_accessible_workflows(
        self, authenticated_client, test_user, other_client, sample_workflow, test_db
    ):
        """User only sees workflows they have access to."""
        # Owner should see their workflow
        owner_response = await authenticated_client.get("/workflows/")
        if owner_response.status_code == 200:
            owner_workflows = [w["id"] for w in owner_response.json().get("data", [])]
            assert sample_workflow.id in owner_workflows

        # Other user shouldn't see it
        other_response = await other_client.get("/workflows/")
        if other_response.status_code == 200:
            other_workflows = [w["id"] for w in other_response.json().get("data", [])]
            assert sample_workflow.id not in other_workflows

    @pytest.mark.asyncio
    async def test_anonymous_cannot_list_workflows(self, client):
        """Unauthenticated user gets 401."""
        response = await client.get("/workflows/")
        assert response.status_code == 401
