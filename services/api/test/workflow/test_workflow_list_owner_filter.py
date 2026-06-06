"""Tests for GET /workflows owner_id filtering."""

import pytest

from src.workflow.service import WorkflowService


class TestWorkflowListOwnerFilter:
    """Verify owner_id query param on the list workflows endpoint."""

    @pytest.mark.asyncio
    async def test_admin_lists_all_workflows_without_owner_filter(
        self,
        admin_client,
        sample_workflow,
        workflow_service: WorkflowService,
        other_user,
    ):
        other_workflow = await workflow_service.create(
            user_id=other_user.id,
            name="Other User Workflow",
            description="Owned by another user",
        )

        response = await admin_client.get("/workflows/")
        assert response.status_code == 200

        workflow_ids = {item["id"] for item in response.json()["data"]}
        assert sample_workflow.id in workflow_ids
        assert other_workflow.id in workflow_ids

    @pytest.mark.asyncio
    async def test_admin_filters_workflows_by_owner_id(
        self,
        admin_client,
        sample_workflow,
        workflow_service: WorkflowService,
        test_user,
        other_user,
    ):
        other_workflow = await workflow_service.create(
            user_id=other_user.id,
            name="Other User Workflow",
            description="Owned by another user",
        )

        owner_response = await admin_client.get(
            "/workflows/", params={"owner_id": test_user.id}
        )
        assert owner_response.status_code == 200
        owner_items = owner_response.json()["data"]
        owner_ids = {item["id"] for item in owner_items}

        assert sample_workflow.id in owner_ids
        assert other_workflow.id not in owner_ids
        assert all(item["owner_name"] == test_user.name for item in owner_items)

        other_owner_response = await admin_client.get(
            "/workflows/", params={"owner_id": other_user.id}
        )
        assert other_owner_response.status_code == 200
        other_owner_ids = {item["id"] for item in other_owner_response.json()["data"]}

        assert other_workflow.id in other_owner_ids
        assert sample_workflow.id not in other_owner_ids

    @pytest.mark.asyncio
    async def test_admin_owner_filter_with_no_matches_returns_empty(
        self, admin_client, sample_workflow, test_admin
    ):
        response = await admin_client.get(
            "/workflows/", params={"owner_id": test_admin.id}
        )
        assert response.status_code == 200
        assert response.json()["data"] == []

    @pytest.mark.asyncio
    async def test_non_admin_filters_visible_workflows_by_owner_id(
        self,
        authenticated_client,
        viewer_client,
        workflow_with_viewer,
        workflow_service: WorkflowService,
        test_user,
        viewer_user,
    ):
        owned_response = await authenticated_client.get(
            "/workflows/", params={"owner_id": test_user.id}
        )
        assert owned_response.status_code == 200
        owned_ids = {item["id"] for item in owned_response.json()["data"]}
        assert workflow_with_viewer.id in owned_ids

        self_owned_response = await authenticated_client.get(
            "/workflows/", params={"owner_id": viewer_user.id}
        )
        assert self_owned_response.status_code == 200
        assert self_owned_response.json()["data"] == []

        shared_response = await viewer_client.get(
            "/workflows/", params={"owner_id": test_user.id}
        )
        assert shared_response.status_code == 200
        shared_ids = {item["id"] for item in shared_response.json()["data"]}
        assert workflow_with_viewer.id in shared_ids
        assert all(item["role"] == "viewer" for item in shared_response.json()["data"])

        viewer_self_response = await viewer_client.get(
            "/workflows/", params={"owner_id": viewer_user.id}
        )
        assert viewer_self_response.status_code == 200
        assert viewer_self_response.json()["data"] == []

    @pytest.mark.asyncio
    async def test_non_admin_owner_filter_does_not_expose_inaccessible_workflows(
        self,
        other_client,
        sample_workflow,
        test_user,
    ):
        response = await other_client.get(
            "/workflows/", params={"owner_id": test_user.id}
        )
        assert response.status_code == 200
        assert response.json()["data"] == []
