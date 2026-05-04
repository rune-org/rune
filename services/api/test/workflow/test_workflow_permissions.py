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
                "base_version_id": workflow_with_editor.latest_version_id,
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
        """Owner sees their own workflow; other user does not."""
        owner_response = await authenticated_client.get("/workflows/")
        assert owner_response.status_code == 200
        owner_ids = [w["id"] for w in owner_response.json()["data"]]
        assert sample_workflow.id in owner_ids

        other_response = await other_client.get("/workflows/")
        assert other_response.status_code == 200
        other_ids = [w["id"] for w in other_response.json()["data"]]
        assert sample_workflow.id not in other_ids

    @pytest.mark.asyncio
    async def test_user_cannot_access_deleted_workflow_from_other_user(
        self, authenticated_client, other_client, sample_workflow, test_db
    ):
        """After owner deletes workflow, no other user can access it."""
        workflow_id = sample_workflow.id

        # Owner deletes
        delete_response = await authenticated_client.delete(f"/workflows/{workflow_id}")
        assert delete_response.status_code == 204

        # Deleted workflow is gone — should be 404, not 403
        access_response = await other_client.get(f"/workflows/{workflow_id}")
        assert access_response.status_code == 404


class TestWorkflowSharing:
    """Test the workflow sharing API endpoints."""

    @pytest.mark.asyncio
    async def test_owner_can_share_workflow_with_viewer_role(
        self, authenticated_client, sample_workflow, other_user
    ):
        """Owner can grant VIEWER access to another user."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/share",
            json={"user_id": other_user.id, "role": "viewer"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_owner_can_share_workflow_with_editor_role(
        self, authenticated_client, sample_workflow, other_user
    ):
        """Owner can grant EDITOR access to another user."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/share",
            json={"user_id": other_user.id, "role": "editor"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_owner_cannot_grant_owner_role_via_share(
        self, authenticated_client, sample_workflow, other_user
    ):
        """OWNER role cannot be granted through the share endpoint."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/share",
            json={"user_id": other_user.id, "role": "OWNER"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_viewer_cannot_share_workflow(
        self, viewer_client, workflow_with_viewer
    ):
        """VIEWER cannot share a workflow."""
        response = await viewer_client.post(
            f"/workflows/{workflow_with_viewer.id}/share",
            json={"user_id": 999, "role": "VIEWER"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_share_with_nonexistent_user_returns_error(
        self, authenticated_client, sample_workflow
    ):
        """Sharing with a user ID that doesn't exist returns 404."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/share",
            json={"user_id": 999999, "role": "viewer"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_owner_can_revoke_access(
        self, authenticated_client, sample_workflow, other_user, test_db
    ):
        """Owner can revoke a user's access to their workflow."""
        # Grant access first
        await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/share",
            json={"user_id": other_user.id, "role": "viewer"},
        )

        # Revoke it
        response = await authenticated_client.delete(
            f"/workflows/{sample_workflow.id}/share/{other_user.id}"
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_owner_cannot_revoke_their_own_access(
        self, authenticated_client, sample_workflow, test_user
    ):
        """Owner cannot revoke their own access."""
        response = await authenticated_client.delete(
            f"/workflows/{sample_workflow.id}/share/{test_user.id}"
        )
        assert response.status_code in [400, 403]

    @pytest.mark.asyncio
    async def test_viewer_can_list_workflow_permissions(
        self, viewer_client, workflow_with_viewer
    ):
        """Any user with access can list who has permissions on a workflow."""
        response = await viewer_client.get(
            f"/workflows/{workflow_with_viewer.id}/permissions"
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_user_without_access_cannot_list_permissions(
        self, other_client, sample_workflow
    ):
        """User with no access cannot list permissions."""
        response = await other_client.get(
            f"/workflows/{sample_workflow.id}/permissions"
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_owner_can_update_user_role(
        self, authenticated_client, sample_workflow, other_user, test_db
    ):
        """Owner can change a user's role from VIEWER to EDITOR."""
        # Grant VIEWER first
        await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/share",
            json={"user_id": other_user.id, "role": "viewer"},
        )

        # Upgrade to EDITOR
        response = await authenticated_client.patch(
            f"/workflows/{sample_workflow.id}/permissions/{other_user.id}",
            json={"role": "editor"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_viewer_cannot_update_roles(
        self, viewer_client, workflow_with_viewer, other_user
    ):
        """VIEWER cannot update user roles."""
        response = await viewer_client.patch(
            f"/workflows/{workflow_with_viewer.id}/permissions/{other_user.id}",
            json={"role": "EDITOR"},
        )
        assert response.status_code == 403
