"""API-level tests verifying workflow state persistence.

These tests verify that API changes result in correct database state persistence,
from a user's perspective (what they observe through API responses).

Unlike unit tests of the service layer, these test the API contract:
- When I publish a workflow through the API, is it actually published?
- When I create a version, does the version number increment correctly?
- Does the published_version_id persist across requests?
"""

import pytest
from sqlmodel import select

from src.db.models import Workflow, WorkflowVersion


class TestWorkflowPersistenceThroughAPI:
    """Test that API operations persist correct state."""

    @pytest.mark.asyncio
    async def test_published_workflow_state_persists_across_requests(
        self, authenticated_client, sample_workflow, test_db
    ):
        """Published version stays published when fetching workflow again."""
        # Publish through API
        detail1 = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        version_id = detail1.json()["data"]["latest_version"]["id"]

        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        # Fetch again - published state should persist
        detail2 = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        data = detail2.json()["data"]
        assert data["is_active"] is True
        assert data["published_version_id"] == version_id

    @pytest.mark.asyncio
    async def test_version_number_increments_correctly_through_api(
        self, authenticated_client, sample_workflow
    ):
        """Creating versions through API increments version number."""
        # Get first version
        detail1 = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        v1 = detail1.json()["data"]["latest_version"]
        assert v1["version"] == 1

        # Create second version
        await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": v1["id"],
                "workflow_data": {
                    "nodes": [
                        {
                            "id": "trigger",
                            "type": "trigger",
                            "trigger": True,
                            "data": {"label": "Modified"},
                        }
                    ],
                    "edges": [],
                },
                "message": "v2",
            },
        )

        # Fetch - version number should increment
        detail2 = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        v2 = detail2.json()["data"]["latest_version"]
        assert v2["version"] == 2

        # Create third version
        await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": v2["id"],
                "workflow_data": {
                    "nodes": [
                        {
                            "id": "trigger",
                            "type": "trigger",
                            "trigger": True,
                            "data": {"label": "Modified again"},
                        }
                    ],
                    "edges": [],
                },
                "message": "v3",
            },
        )

        detail3 = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        v3 = detail3.json()["data"]["latest_version"]
        assert v3["version"] == 3

    @pytest.mark.asyncio
    async def test_unpublished_workflow_clears_published_id(
        self, authenticated_client, sample_workflow
    ):
        """Unpublishing workflow clears published_version_id in database."""
        # Publish
        detail1 = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        version_id = detail1.json()["data"]["latest_version"]["id"]

        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        # Verify it's published
        detail2 = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        assert detail2.json()["data"]["published_version_id"] == version_id

        # Unpublish
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": False},
        )

        # Verify published_id cleared
        detail3 = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        assert detail3.json()["data"]["published_version_id"] is None
        assert detail3.json()["data"]["is_active"] is False

    @pytest.mark.asyncio
    async def test_restored_version_creates_new_database_record(
        self, authenticated_client, sample_workflow, test_db
    ):
        """Restoring version creates new version record with incremented version number."""
        # Get original version
        detail1 = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        v1_id = detail1.json()["data"]["latest_version"]["id"]

        # Restore it
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/restore/{v1_id}",
            json={"message": "Restored from v1"},
        )
        assert response.status_code == 201

        # Verify new record with incremented version
        restored = response.json()["data"]
        assert restored["version"] == 2
        assert restored["id"] != v1_id  # Different record
        assert restored["message"] == "Restored from v1"

        # Verify in database
        result = await test_db.exec(
            select(WorkflowVersion).where(WorkflowVersion.id == restored["id"])
        )
        persisted = result.first()
        assert persisted is not None
        assert persisted.version == 2

    @pytest.mark.asyncio
    async def test_workflow_name_update_persists(
        self, authenticated_client, sample_workflow, test_db
    ):
        """Updating workflow name through API persists to database."""
        new_name = "Renamed Workflow"
        workflow_id = sample_workflow.id

        # Update name
        await authenticated_client.put(
            f"/workflows/{workflow_id}/name",
            json={"name": new_name},
        )

        # Verify persisted in DB
        result = await test_db.exec(select(Workflow).where(Workflow.id == workflow_id))
        persisted = result.first()
        assert persisted is not None
        assert persisted.name == new_name

        # Verify through API
        detail = await authenticated_client.get(f"/workflows/{workflow_id}")
        assert detail.json()["data"]["name"] == new_name
