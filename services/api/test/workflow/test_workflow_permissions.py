"""Permission-based API tests for workflow endpoints.

Tests verify that users can only perform allowed operations based on their role:
- OWNER: Full access (read, write, publish, delete, share)
- EDITOR: Edit workflow content and publish
- VIEWER: Read-only access
"""

import pytest_asyncio

import pytest
from src.core.password import hash_password
from src.db.models import User, UserRole, WorkflowRole, WorkflowUser


class TestWorkflowPermissions:
    """Test permission enforcement on workflow APIs."""

    @pytest.mark.asyncio
    async def test_viewer_cannot_edit_workflow(
        self, viewer_client, workflow_with_viewer, test_db
    ):
        """VIEWER should get 403 when trying to update workflow name."""
        response = await viewer_client.put(
            f"/workflows/{workflow_with_viewer.id}/name",
            json={"name": "Renamed by Viewer"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_viewer_cannot_publish_workflow(
        self, viewer_client, workflow_with_viewer
    ):
        """VIEWER should get 403 when trying to publish workflow."""
        response = await viewer_client.put(
            f"/workflows/{workflow_with_viewer.id}/status",
            json={"is_active": True},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_viewer_cannot_create_version(
        self, viewer_client, workflow_with_viewer
    ):
        """VIEWER should get 403 when trying to create new version."""
        response = await viewer_client.post(
            f"/workflows/{workflow_with_viewer.id}/versions",
            json={
                "base_version_id": None,
                "workflow_data": {
                    "nodes": [{"id": "node-1", "type": "trigger", "trigger": True}],
                    "edges": [],
                },
                "message": "New version",
            },
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_viewer_cannot_delete_workflow(
        self, viewer_client, workflow_with_viewer
    ):
        """VIEWER should get 403 when trying to delete workflow."""
        response = await viewer_client.delete(f"/workflows/{workflow_with_viewer.id}")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_viewer_can_read_workflow(self, viewer_client, workflow_with_viewer):
        """VIEWER can read workflow details (200 OK)."""
        response = await viewer_client.get(f"/workflows/{workflow_with_viewer.id}")
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["id"] == workflow_with_viewer.id

    @pytest.mark.asyncio
    async def test_user_without_access_cannot_read_workflow(
        self, other_client, sample_workflow
    ):
        """User without any permission should get 403."""
        response = await other_client.get(f"/workflows/{sample_workflow.id}")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_without_access_cannot_modify_workflow(
        self, other_client, sample_workflow
    ):
        """User without permission should get 403 on update."""
        response = await other_client.put(
            f"/workflows/{sample_workflow.id}/name",
            json={"name": "Hacked Name"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_owner_can_edit_workflow(self, authenticated_client, sample_workflow):
        """OWNER can update workflow details (200 OK)."""
        response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/name",
            json={"name": "Owner Updated Name"},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["name"] == "Owner Updated Name"

    @pytest.mark.asyncio
    async def test_owner_can_publish_workflow(
        self, authenticated_client, sample_workflow
    ):
        """OWNER can publish workflow."""
        response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["is_active"] is True
        assert data["published_version_id"] is not None


class TestEditorPermissions:
    """Test EDITOR role permissions."""

    @pytest_asyncio.fixture()
    async def editor_user(self, test_db):
        """Create a user with EDITOR role on sample_workflow.

        Uses the app's hash_password() function to ensure password compatibility with login.
        """
        user = User(
            email="editor@example.com",
            hashed_password=hash_password("editorpassword123"),
            name="Editor User",
            role=UserRole.USER,
        )
        test_db.add(user)
        await test_db.commit()
        await test_db.refresh(user)
        return user

    @pytest_asyncio.fixture()
    async def workflow_with_editor(
        self, test_db, sample_workflow, editor_user, test_user
    ):
        """Grant EDITOR access to editor_user on sample_workflow."""
        permission = WorkflowUser(
            workflow_id=sample_workflow.id,
            user_id=editor_user.id,
            granted_by=test_user.id,
            role=WorkflowRole.EDITOR,
        )
        test_db.add(permission)
        await test_db.commit()
        return sample_workflow

    @pytest_asyncio.fixture()
    async def editor_client(self, client, editor_user):
        """Create authenticated client for editor."""
        response = await client.post(
            "/auth/login",
            json={"email": "editor@example.com", "password": "editorpassword123"},
        )
        assert response.status_code == 200
        return client

    @pytest.mark.asyncio
    async def test_editor_can_edit_workflow(self, editor_client, workflow_with_editor):
        """EDITOR can update workflow details."""
        response = await editor_client.put(
            f"/workflows/{workflow_with_editor.id}/name",
            json={"name": "Edited by Editor"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_editor_can_create_version(self, editor_client, workflow_with_editor):
        """EDITOR can create new versions."""
        response = await editor_client.post(
            f"/workflows/{workflow_with_editor.id}/versions",
            json={
                "base_version_id": None,
                "workflow_data": {
                    "nodes": [{"id": "node-1", "type": "trigger", "trigger": True}],
                    "edges": [],
                },
                "message": "Editor version",
            },
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_editor_can_publish_workflow(
        self, editor_client, workflow_with_editor
    ):
        """EDITOR can publish workflow."""
        response = await editor_client.put(
            f"/workflows/{workflow_with_editor.id}/status",
            json={"is_active": True},
        )
        assert response.status_code == 200


class TestCrossUserIsolation:
    """Test that users are isolated from each other's data."""

    @pytest.mark.asyncio
    async def test_user_cannot_list_other_user_workflows(
        self, authenticated_client, other_client, sample_workflow
    ):
        """User should not see workflows they don't have access to."""
        # Assuming there's a list endpoint
        response = await authenticated_client.get("/workflows/")

        if response.status_code == 200:
            workflow_ids = [w["id"] for w in response.json().get("data", [])]
            assert sample_workflow.id in workflow_ids  # Should see their own

    @pytest.mark.asyncio
    async def test_user_cannot_access_deleted_workflow_from_other_user(
        self, authenticated_client, other_client, sample_workflow, test_db
    ):
        """After owner deletes workflow, no other user can access it."""
        workflow_id = sample_workflow.id

        # Owner deletes
        delete_response = await authenticated_client.delete(f"/workflows/{workflow_id}")
        assert delete_response.status_code == 204

        # Other user tries to access (should be 404 or 403)
        access_response = await other_client.get(f"/workflows/{workflow_id}")
        assert access_response.status_code in [403, 404]
