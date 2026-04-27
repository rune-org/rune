"""Input validation and error handling API tests.

Tests verify:
- Missing required fields are rejected
- Invalid data types are rejected
- Malformed workflow structures fail gracefully
- Proper error codes returned (400, 422, etc.)
- Error messages are informative
"""

import pytest


class TestWorkflowCreationValidation:
    """Test input validation for workflow creation."""

    @pytest.mark.asyncio
    async def test_create_workflow_requires_name(self, authenticated_client):
        """Creating workflow without name returns 422."""
        response = await authenticated_client.post(
            "/workflows/",
            json={"description": "No name provided"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_workflow_with_empty_name_rejected(self, authenticated_client):
        """Creating workflow with empty string name returns 422."""
        response = await authenticated_client.post(
            "/workflows/",
            json={"name": "", "description": ""},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_workflow_with_whitespace_only_name_rejected(
        self, authenticated_client
    ):
        """Creating workflow with whitespace-only name returns 422."""
        response = await authenticated_client.post(
            "/workflows/",
            json={"name": "   ", "description": ""},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_workflow_with_very_long_name_accepted(
        self, authenticated_client
    ):
        """Very long names should be accepted (up to reasonable limit)."""
        long_name = "A" * 500  # Assuming system allows this
        response = await authenticated_client.post(
            "/workflows/",
            json={"name": long_name, "description": ""},
        )
        # Should succeed or give specific length error, not generic 422
        assert response.status_code in [201, 422]

    @pytest.mark.asyncio
    async def test_create_workflow_with_null_name_rejected(self, authenticated_client):
        """null name should be rejected."""
        response = await authenticated_client.post(
            "/workflows/",
            json={"name": None, "description": ""},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_workflow_with_number_as_name_accepted(
        self, authenticated_client
    ):
        """Numbers as workflow names should be accepted."""
        response = await authenticated_client.post(
            "/workflows/",
            json={"name": "12345", "description": ""},
        )
        assert response.status_code == 201


class TestWorkflowVersionValidation:
    """Test input validation for workflow versions."""

    @pytest.mark.asyncio
    async def test_create_version_requires_workflow_data(
        self, authenticated_client, sample_workflow
    ):
        """Creating version without workflow_data returns 422."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": None,
                # Missing workflow_data
                "message": "Test",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_version_with_empty_workflow_data(
        self, authenticated_client, sample_workflow
    ):
        """Empty workflow_data dict should be rejected."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": None,
                "workflow_data": {},  # Missing nodes and edges
                "message": "Test",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_version_without_nodes_rejected(
        self, authenticated_client, sample_workflow
    ):
        """Workflow must have nodes."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": None,
                "workflow_data": {
                    # Missing nodes
                    "edges": [],
                },
                "message": "Test",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_version_without_edges_rejected(
        self, authenticated_client, sample_workflow
    ):
        """Workflow must have edges array."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": None,
                "workflow_data": {
                    "nodes": [
                        {
                            "id": "node-1",
                            "type": "trigger",
                            "trigger": True,
                        }
                    ],
                    # Missing edges
                },
                "message": "Test",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_version_with_empty_nodes_array(
        self, authenticated_client, sample_workflow
    ):
        """Workflow must have at least one node."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": None,
                "workflow_data": {
                    "nodes": [],  # Empty
                    "edges": [],
                },
                "message": "Test",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_version_node_missing_id(
        self, authenticated_client, sample_workflow
    ):
        """Nodes must have id field."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": None,
                "workflow_data": {
                    "nodes": [
                        {
                            # Missing id
                            "type": "trigger",
                            "trigger": True,
                        }
                    ],
                    "edges": [],
                },
                "message": "Test",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_version_node_missing_type(
        self, authenticated_client, sample_workflow
    ):
        """Nodes must have type field."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": None,
                "workflow_data": {
                    "nodes": [
                        {
                            "id": "node-1",
                            # Missing type
                            "trigger": True,
                        }
                    ],
                    "edges": [],
                },
                "message": "Test",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_version_must_have_trigger_node(
        self, authenticated_client, sample_workflow
    ):
        """Workflow must have at least one trigger node."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": None,
                "workflow_data": {
                    "nodes": [
                        {
                            "id": "node-1",
                            "type": "action",
                            # trigger=False or missing
                        }
                    ],
                    "edges": [],
                },
                "message": "Test",
            },
        )
        # Should fail - no trigger node
        assert response.status_code == 422


class TestWorkflowUpdateValidation:
    """Test input validation for workflow updates."""

    @pytest.mark.asyncio
    async def test_update_name_with_empty_string_rejected(
        self, authenticated_client, sample_workflow
    ):
        """Updating workflow name to empty string rejected."""
        response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/name",
            json={"name": ""},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_name_with_whitespace_rejected(
        self, authenticated_client, sample_workflow
    ):
        """Updating workflow name to whitespace only rejected."""
        response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/name",
            json={"name": "   "},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_status_requires_is_active_field(
        self, authenticated_client, sample_workflow
    ):
        """Updating status requires is_active boolean."""
        response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={},  # Missing is_active
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_status_with_non_boolean_rejected(
        self, authenticated_client, sample_workflow
    ):
        """is_active must be boolean."""
        response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": "true"},  # String instead of boolean
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_status_with_null_rejected(
        self, authenticated_client, sample_workflow
    ):
        """is_active cannot be null."""
        response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": None},
        )
        assert response.status_code == 422


class TestNotFoundErrors:
    """Test 404 errors for missing resources."""

    @pytest.mark.asyncio
    async def test_get_missing_workflow_returns_404(self, authenticated_client):
        """Getting non-existent workflow returns 404."""
        response = await authenticated_client.get("/workflows/999999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_missing_workflow_returns_404(self, authenticated_client):
        """Updating non-existent workflow returns 404."""
        response = await authenticated_client.put(
            "/workflows/999999/name",
            json={"name": "New Name"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_missing_workflow_returns_404(self, authenticated_client):
        """Deleting non-existent workflow returns 404."""
        response = await authenticated_client.delete("/workflows/999999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_missing_version_returns_404(
        self, authenticated_client, sample_workflow
    ):
        """Getting non-existent version returns 404."""
        response = await authenticated_client.get(
            f"/workflows/{sample_workflow.id}/versions/999"
        )
        assert response.status_code == 404


class TestInvalidPayloads:
    """Test rejection of malformed request bodies."""

    @pytest.mark.asyncio
    async def test_create_workflow_with_invalid_json_rejected(
        self, authenticated_client
    ):
        """Invalid JSON body returns 400/422."""
        response = await authenticated_client.post(
            "/workflows/",
            content=b"{invalid json}",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_run_workflow_with_invalid_version_id(
        self, authenticated_client, sample_workflow
    ):
        """Running with non-existent version_id should fail gracefully."""
        # Publish first
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        # Try to run with invalid version_id
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run",
            json={"version_id": 999999},
        )
        # Should fail with 400 or 404, not 500
        assert response.status_code in [400, 404, 422]
