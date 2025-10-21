"""Edge case and boundary tests for workflow functionality."""

import pytest


class TestEdgeCases:
    """Tests for boundary conditions and edge cases."""

    @pytest.mark.asyncio
    async def test_workflow_with_maximum_int_id(self, authenticated_client):
        """Should handle very large workflow IDs gracefully."""
        response = await authenticated_client.get(f"/workflows/{2147483647}")
        # Should return 404, not crash
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_null_required_field(self, authenticated_client):
        """Should reject null values for required fields."""
        response = await authenticated_client.post(
            "/workflows/",
            json={
                "name": None,
                "description": "",
                "workflow_data": {},
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_very_long_name_accepted(self, authenticated_client):
        """Should accept long workflow names."""
        long_name = "A" * 255

        response = await authenticated_client.post(
            "/workflows/",
            json={
                "name": long_name,
                "description": "",
                "workflow_data": {},
            },
        )

        assert response.status_code in [201, 200]

    @pytest.mark.asyncio
    async def test_repeated_operations_on_same_workflow(
        self, authenticated_client, sample_workflow
    ):
        """Should handle repeated operations on same workflow."""
        for i in range(10):
            response = await authenticated_client.get(
                f"/workflows/{sample_workflow.id}"
            )
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_name_must_be_string(self, authenticated_client, sample_workflow):
        """Should reject non-string name."""
        response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/name",
            json={"name": 123},
        )

        assert response.status_code == 422


class TestSpecialCharactersAndEncoding:
    """Tests for special characters and encoding edge cases."""

    @pytest.mark.asyncio
    async def test_workflow_name_with_sql_injection_attempt(self, authenticated_client):
        """Should safely handle SQL injection attempts in name."""
        malicious_name = "'; DROP TABLE workflows; --"
        response = await authenticated_client.post(
            "/workflows/",
            json={
                "name": malicious_name,
                "description": "",
                "workflow_data": {},
            },
        )

        # Should treat as normal string, not execute
        assert response.status_code == 201

        # Verify it was stored as plain text, not executed
        workflow_id = response.json()["data"]["id"]
        get_response = await authenticated_client.get(f"/workflows/{workflow_id}")

        # The dangerous string should be stored exactly as-is
        assert get_response.json()["data"]["name"] == malicious_name

        # Verify the workflows table still exists (wasn't dropped!)
        list_response = await authenticated_client.get("/workflows/")
        assert list_response.status_code == 200

    @pytest.mark.asyncio
    async def test_workflow_description_with_html_tags(self, authenticated_client):
        """Should safely store HTML/JavaScript as plain text."""
        malicious_html = "<script>alert('xss')</script>"

        # Create workflow with XSS attempt
        response = await authenticated_client.post(
            "/workflows/",
            json={
                "name": "XSS Test",
                "description": malicious_html,
                "workflow_data": {},
            },
        )

        # Should treat as normal string, not execute
        assert response.status_code == 201

        # Verify it's stored exactly as plain text, not executed
        workflow_id = response.json()["data"]["id"]
        get_response = await authenticated_client.get(f"/workflows/{workflow_id}")

        stored_description = get_response.json()["data"]["description"]
        assert stored_description == malicious_html

        # Verify the response is JSON (not HTML that could execute)
        assert get_response.headers["content-type"] == "application/json"

    @pytest.mark.asyncio
    async def test_create_workflow_with_special_characters(self, authenticated_client):
        """Should preserve special characters when creating workflow."""
        special_name = "Workflow!@#$%^&*()_+-=[]{}|;:,.<>?"

        # Create workflow with special characters
        response = await authenticated_client.post(
            "/workflows/",
            json={
                "name": special_name,
                "description": "Test description",
                "workflow_data": {},
            },
        )

        # Creation should succeed
        assert response.status_code == 201

        # Verify special characters were preserved
        created_data = response.json()["data"]
        assert created_data["name"] == special_name

    @pytest.mark.asyncio
    async def test_rename_with_special_characters(
        self, authenticated_client, sample_workflow
    ):
        """Should preserve special characters in rename."""
        special_name = "Workflow!@#$%^&*()_+-=[]{}|;:,.<>?"

        response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/name",
            json={"name": special_name},
        )

        assert response.status_code == 200

        # Verify special characters were preserved
        get_response = await authenticated_client.get(
            f"/workflows/{sample_workflow.id}"
        )
        assert get_response.json()["data"]["name"] == special_name
