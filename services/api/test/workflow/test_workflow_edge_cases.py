"""Edge case tests for workflow versioning endpoints."""

import pytest


class TestWorkflowEdgeCases:
    @pytest.mark.asyncio
    async def test_get_missing_workflow_returns_404(self, authenticated_client):
        response = await authenticated_client.get("/workflows/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_blank_name_rejected(self, authenticated_client):
        response = await authenticated_client.post(
            "/workflows/",
            json={"name": "   ", "description": ""},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_missing_base_version_for_non_initial_save_conflicts(
        self, authenticated_client, sample_workflow
    ):
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": None,
                "workflow_data": {
                    "nodes": [{"id": "node-1", "type": "trigger", "trigger": True}],
                    "edges": [],
                },
            },
        )

        assert response.status_code == 409
        assert response.json()["message"] == "version_conflict"

    @pytest.mark.asyncio
    async def test_special_characters_preserved_in_name(self, authenticated_client):
        special_name = "Workflow!@#$%^&*()_+-=[]{}|;:,.<>?"
        response = await authenticated_client.post(
            "/workflows/",
            json={"name": special_name, "description": "desc"},
        )

        assert response.status_code == 201
        assert response.json()["data"]["name"] == special_name

    @pytest.mark.asyncio
    async def test_get_workflow_detail_no_longer_exposes_root_workflow_data(
        self, authenticated_client, sample_workflow
    ):
        response = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        assert response.status_code == 200

        data = response.json()["data"]
        assert "workflow_data" not in data
        assert "latest_version" in data
