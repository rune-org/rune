"""API endpoint tests for workflow operations."""

import pytest


class TestAPIAuthentication:
    """Tests for API authentication requirements."""

    @pytest.mark.asyncio
    async def test_create_workflow_requires_auth(self, client):
        """Should reject unauthenticated workflow creation."""
        response = await client.post(
            "/workflows/", json={"name": "Test", "description": "", "workflow_data": {}}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_workflows_requires_auth(self, client):
        """Should reject unauthenticated workflow listing."""
        response = await client.get("/workflows/")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_workflow_requires_auth(self, client, sample_workflow):
        """Should reject unauthenticated workflow retrieval."""
        response = await client.get(f"/workflows/{sample_workflow.id}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_update_name_requires_auth(self, client, sample_workflow):
        """Should reject unauthenticated workflow rename."""
        response = await client.put(
            f"/workflows/{sample_workflow.id}/name", json={"name": "New Name"}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_update_status_requires_auth(self, client, sample_workflow):
        """Should reject unauthenticated status update."""
        response = await client.put(
            f"/workflows/{sample_workflow.id}/status", json={"is_active": False}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_workflow_requires_auth(self, client, sample_workflow):
        """Should reject unauthenticated workflow deletion."""
        response = await client.delete(f"/workflows/{sample_workflow.id}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_run_workflow_requires_auth(self, client, sample_workflow):
        """Should reject unauthenticated workflow run."""
        response = await client.post(f"/workflows/{sample_workflow.id}/run")
        assert response.status_code == 401


class TestAPINotFound:
    """Tests for 404 scenarios."""

    @pytest.mark.asyncio
    async def test_get_nonexistent_workflow_returns_404(self, authenticated_client):
        """Should return 404 for non-existent workflow."""
        response = await authenticated_client.get("/workflows/99999")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_workflow_returns_404(self, authenticated_client):
        """Should return 404 when deleting non-existent workflow."""
        response = await authenticated_client.delete("/workflows/99999")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_run_nonexistent_workflow_returns_404(self, authenticated_client):
        """Should return 404 when running non-existent workflow."""
        response = await authenticated_client.post("/workflows/99999/run")

        assert response.status_code == 404


class TestAPIValidation:
    """Tests for request validation."""

    @pytest.mark.asyncio
    async def test_create_missing_required_fields(self, authenticated_client):
        """Should reject creation with missing required fields (name is required)."""
        response = await authenticated_client.post(
            "/workflows/",
            json={},  # missing name, description and workflow_data are optional
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_with_extra_unknown_fields(self, authenticated_client):
        """Should ignore extra unknown fields."""
        response = await authenticated_client.post(
            "/workflows/",
            json={
                "name": "Test",
                "description": "",
                "workflow_data": {},
                "unknown_field": "should be ignored",
            },
        )

        # Should succeed
        assert response.status_code in [201, 200]

    @pytest.mark.asyncio
    async def test_rename_missing_name_field(
        self, authenticated_client, sample_workflow
    ):
        """Should reject rename without name field."""
        response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/name",
            json={},  # missing name
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_status_update_missing_is_active(
        self, authenticated_client, sample_workflow
    ):
        """Should reject status update without is_active field."""
        response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={},  # missing is_active
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_json_body(self, authenticated_client):
        """Should reject malformed JSON."""
        response = await authenticated_client.post(
            "/workflows/",
            content=b"{invalid json}",
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_empty_string_description_allowed(self, authenticated_client):
        """Should allow empty string for description."""
        response = await authenticated_client.post(
            "/workflows/",
            json={
                "name": "Test",
                "description": "",
                "workflow_data": {},
            },
        )

        assert response.status_code in [201, 200]


class TestAPISuccess:
    """Tests for successful API responses."""

    @pytest.mark.asyncio
    async def test_create_returns_workflow_object(self, authenticated_client):
        """Should return created workflow object."""
        response = await authenticated_client.post(
            "/workflows/",
            json={
                "name": "Test",
                "description": "desc",
                "workflow_data": {},
            },
        )

        data = response.json()["data"]
        assert "id" in data
        assert data["name"] == "Test"
        assert data["description"] == "desc"

    @pytest.mark.asyncio
    async def test_get_workflow_returns_200(
        self, authenticated_client, sample_workflow
    ):
        """Should return 200 for successful workflow retrieval."""
        response = await authenticated_client.get(f"/workflows/{sample_workflow.id}")

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_list_workflows_returns_200(self, authenticated_client):
        """Should return 200 for workflow list."""
        response = await authenticated_client.get("/workflows/")

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_update_name_returns_200(self, authenticated_client, sample_workflow):
        """Should return 200 for successful name update."""
        response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/name",
            json={"name": "New Name"},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_workflow_returns_204(
        self, authenticated_client, sample_workflow
    ):
        """Should return 204 for successful deletion."""
        response = await authenticated_client.delete(f"/workflows/{sample_workflow.id}")

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_set_active_returns_200(self, authenticated_client, sample_workflow):
        """Should return 200 for status update."""
        response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_run_workflow_returns_200(
        self, authenticated_client, sample_workflow
    ):
        """Should return 200 when queuing workflow for execution."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run"
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_run_inactive_workflow_succeeds(
        self, authenticated_client, workflow_service, test_db, sample_workflow
    ):
        """Should allow running inactive workflow when explicitly triggered by user."""
        # Set workflow to inactive
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": False},
        )

        # User explicitly runs the workflow
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run"
        )

        # Should succeed (user explicitly requested it)
        assert response.status_code == 200

        # Verify workflow remains inactive after run
        await test_db.refresh(sample_workflow)
        assert sample_workflow.is_active is False

    @pytest.mark.asyncio
    async def test_run_workflow_multiple_times(
        self, authenticated_client, sample_workflow
    ):
        """Should allow running same workflow multiple times."""
        # First run
        response1 = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run"
        )
        assert response1.status_code == 200

        # Second run (should also succeed)
        response2 = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run"
        )
        assert response2.status_code == 200


class TestAPIAuthorization:
    """Tests for API authorization and permissions."""

    @pytest.mark.asyncio
    async def test_user_cannot_update_other_user_workflow(
        self, authenticated_client, workflow_service, other_user
    ):
        """Should deny updating workflows owned by other users."""
        # Create workflow owned by other_user
        other_workflow = await workflow_service.create(
            user_id=other_user.id,
            name="Other User Workflow",
            description="",
            workflow_data={},
        )

        # Try to update it
        response = await authenticated_client.put(
            f"/workflows/{other_workflow.id}/name", json={"name": "Hacked Name"}
        )

        # Should deny access
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_delete_other_user_workflow(
        self, authenticated_client, workflow_service, other_user
    ):
        """Should deny deleting workflows owned by other users."""
        # Create workflow owned by other_user
        other_workflow = await workflow_service.create(
            user_id=other_user.id,
            name="Other User Workflow",
            description="",
            workflow_data={},
        )

        # Try to delete it
        response = await authenticated_client.delete(f"/workflows/{other_workflow.id}")

        # Should deny access
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_run_other_user_workflow(
        self, authenticated_client, workflow_service, other_user
    ):
        """Should deny running workflows owned by other users."""
        # Create workflow owned by other_user
        other_workflow = await workflow_service.create(
            user_id=other_user.id,
            name="Other User Workflow",
            description="",
            workflow_data={},
        )

        # Try to run it
        response = await authenticated_client.post(
            f"/workflows/{other_workflow.id}/run"
        )

        # Should deny access
        assert response.status_code == 403


class TestResponseStructure:
    """Tests for API response structures."""

    @pytest.mark.asyncio
    async def test_list_response_structure(self, authenticated_client, sample_workflow):
        """Should return array of objects with required fields."""
        response = await authenticated_client.get("/workflows/")

        data = response.json()["data"]
        assert isinstance(data, list)
        if len(data) > 0:
            required_fields = ["id", "name", "is_active"]
            for field in required_fields:
                assert field in data[0], f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_response_data_types(self, authenticated_client, sample_workflow):
        """Should return correct data types in response."""
        response = await authenticated_client.get(f"/workflows/{sample_workflow.id}")

        data = response.json()["data"]
        assert isinstance(data["id"], int)
        assert isinstance(data["name"], str)
        assert isinstance(data["description"], (str, type(None)))
        assert isinstance(data["workflow_data"], dict)
        assert isinstance(data["is_active"], bool)

    @pytest.mark.asyncio
    async def test_run_workflow_response_structure(
        self, authenticated_client, sample_workflow
    ):
        """Should return success response structure with required fields."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run"
        )

        data = response.json()

        # Check response has required fields
        assert "success" in data
        assert "message" in data
        assert "data" in data

        # Check field types
        assert isinstance(data["success"], bool)
        assert isinstance(data["message"], str)
        assert isinstance(data["data"], dict)
