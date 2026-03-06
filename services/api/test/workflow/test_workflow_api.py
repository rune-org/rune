"""API endpoint tests for workflow versioning."""

import json

import pytest
from sqlmodel import select

from src.db.models import Workflow, WorkflowVersion


class TestWorkflowShellAPI:
    @pytest.mark.asyncio
    async def test_create_workflow_requires_auth(self, client):
        response = await client.post(
            "/workflows/",
            json={"name": "Test", "description": ""},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_shell_without_versions(self, authenticated_client):
        response = await authenticated_client.post(
            "/workflows/",
            json={"name": "Customer onboarding", "description": "Shell only"},
        )

        assert response.status_code == 201
        data = response.json()["data"]
        assert data["name"] == "Customer onboarding"
        assert data["latest_version"] is None
        assert data["published_version_id"] is None
        assert data["has_unpublished_changes"] is False
        assert data["is_active"] is False

    @pytest.mark.asyncio
    async def test_get_workflow_returns_latest_version(self, authenticated_client, sample_workflow):
        response = await authenticated_client.get(f"/workflows/{sample_workflow.id}")

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["id"] == sample_workflow.id
        assert data["latest_version"]["version"] == 1
        assert data["latest_version"]["message"] == "Initial version"
        assert data["published_version_id"] is None
        assert data["has_unpublished_changes"] is True

    @pytest.mark.asyncio
    async def test_update_name_keeps_versions_intact(
        self, authenticated_client, sample_workflow
    ):
        response = await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/name",
            json={"name": "Renamed Workflow"},
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["name"] == "Renamed Workflow"
        assert data["latest_version"]["version"] == 1


class TestWorkflowVersionsAPI:
    @pytest.mark.asyncio
    async def test_create_first_version_for_empty_workflow(self, authenticated_client):
        create_response = await authenticated_client.post(
            "/workflows/",
            json={"name": "Empty workflow", "description": ""},
        )
        workflow_id = create_response.json()["data"]["id"]

        response = await authenticated_client.post(
            f"/workflows/{workflow_id}/versions",
            json={
                "base_version_id": None,
                "workflow_data": {
                    "nodes": [{"id": "trigger", "type": "trigger", "trigger": True}],
                    "edges": [],
                },
                "message": "Initial save",
            },
        )

        assert response.status_code == 201
        data = response.json()["data"]
        assert data["version"] == 1
        assert data["message"] == "Initial save"
        assert data["workflow_data"]["nodes"][0]["id"] == "trigger"

    @pytest.mark.asyncio
    async def test_create_second_version_increments_linearly(
        self, authenticated_client, sample_workflow
    ):
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        latest = detail.json()["data"]["latest_version"]

        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": latest["id"],
                "workflow_data": {
                    "nodes": [
                        {"id": "node-1", "type": "trigger", "trigger": True},
                        {"id": "node-2", "type": "action"},
                        {"id": "node-3", "type": "action"},
                    ],
                    "edges": [
                        {"id": "edge-1", "src": "node-1", "dst": "node-2"},
                        {"id": "edge-2", "src": "node-2", "dst": "node-3"},
                    ],
                },
                "message": "Add second action",
            },
        )

        assert response.status_code == 201
        data = response.json()["data"]
        assert data["version"] == 2
        assert data["message"] == "Add second action"

    @pytest.mark.asyncio
    async def test_create_version_conflict_returns_409(
        self, authenticated_client, sample_workflow
    ):
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        latest = detail.json()["data"]["latest_version"]

        second = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": latest["id"],
                "workflow_data": {
                    "nodes": [{"id": "node-1", "type": "trigger", "trigger": True}],
                    "edges": [],
                },
                "message": "v2",
            },
        )
        assert second.status_code == 201

        conflict = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": latest["id"],
                "workflow_data": {
                    "nodes": [{"id": "node-1", "type": "trigger", "trigger": True}],
                    "edges": [],
                },
                "message": "stale save",
            },
        )

        assert conflict.status_code == 409
        body = conflict.json()
        assert body["success"] is False
        assert body["message"] == "version_conflict"
        assert body["data"]["server_version"] == 2
        assert isinstance(body["data"]["server_version_id"], int)

    @pytest.mark.asyncio
    async def test_list_versions_returns_lightweight_metadata(
        self, authenticated_client, sample_workflow
    ):
        response = await authenticated_client.get(f"/workflows/{sample_workflow.id}/versions")

        assert response.status_code == 200
        data = response.json()["data"]
        assert len(data) == 1
        assert "workflow_data" not in data[0]
        assert data[0]["version"] == 1
        assert data[0]["is_published"] is False

    @pytest.mark.asyncio
    async def test_get_specific_version_returns_workflow_data(
        self, authenticated_client, sample_workflow
    ):
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        version_id = detail.json()["data"]["latest_version"]["id"]

        response = await authenticated_client.get(
            f"/workflows/{sample_workflow.id}/versions/{version_id}"
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["id"] == version_id
        assert "workflow_data" in data
        assert data["workflow_data"]["nodes"][0]["id"] == "node-1"

    @pytest.mark.asyncio
    async def test_publish_sets_published_pointer_and_is_active(
        self, authenticated_client, sample_workflow
    ):
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        version_id = detail.json()["data"]["latest_version"]["id"]

        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/publish",
            json={"version_id": version_id},
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["published_version_id"] == version_id
        assert data["is_active"] is True
        assert data["has_unpublished_changes"] is False

    @pytest.mark.asyncio
    async def test_restore_creates_new_version(
        self, authenticated_client, sample_workflow
    ):
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        version_id = detail.json()["data"]["latest_version"]["id"]

        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/restore/{version_id}",
            json={},
        )

        assert response.status_code == 201
        data = response.json()["data"]
        assert data["version"] == 2
        assert data["message"] == "Restored from v1"


class TestWorkflowRunAPI:
    @pytest.mark.asyncio
    async def test_run_without_saved_versions_returns_400(self, authenticated_client):
        create_response = await authenticated_client.post(
            "/workflows/",
            json={"name": "Empty workflow", "description": ""},
        )
        workflow_id = create_response.json()["data"]["id"]

        response = await authenticated_client.post(f"/workflows/{workflow_id}/run")
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_run_uses_latest_version_metadata(
        self,
        authenticated_client,
        sample_workflow,
        test_rabbitmq,
        test_settings,
    ):
        channel = await test_rabbitmq.channel()
        queue = await channel.declare_queue(
            test_settings.rabbitmq_workflow_queue,
            durable=True,
        )
        await queue.purge()

        response = await authenticated_client.post(f"/workflows/{sample_workflow.id}/run")
        assert response.status_code == 200

        message = await queue.get(timeout=5)
        assert message is not None
        payload = json.loads(message.body.decode("utf-8"))
        assert payload["workflow_id"] == str(sample_workflow.id)
        assert payload["workflow_version"] == 1
        assert payload["workflow_version_id"] > 0

        await channel.close()

    @pytest.mark.asyncio
    async def test_run_can_pin_historical_version(
        self,
        authenticated_client,
        sample_workflow,
        test_rabbitmq,
        test_settings,
    ):
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        first_version = detail.json()["data"]["latest_version"]

        second = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": first_version["id"],
                "workflow_data": {
                    "nodes": [
                        {"id": "node-1", "type": "trigger", "trigger": True},
                        {"id": "node-2", "type": "action"},
                        {"id": "node-3", "type": "action"},
                    ],
                    "edges": [
                        {"id": "edge-1", "src": "node-1", "dst": "node-2"},
                        {"id": "edge-2", "src": "node-2", "dst": "node-3"},
                    ],
                },
                "message": "Add branch",
            },
        )
        assert second.status_code == 201

        channel = await test_rabbitmq.channel()
        queue = await channel.declare_queue(
            test_settings.rabbitmq_workflow_queue,
            durable=True,
        )
        await queue.purge()

        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run",
            json={"version_id": first_version["id"]},
        )
        assert response.status_code == 200

        message = await queue.get(timeout=5)
        assert message is not None
        payload = json.loads(message.body.decode("utf-8"))
        assert payload["workflow_version"] == 1
        assert payload["workflow_version_id"] == first_version["id"]
        assert len(payload["workflow_definition"]["nodes"]) == 2

        await channel.close()


class TestWorkflowAuthorization:
    @pytest.mark.asyncio
    async def test_user_cannot_update_other_user_workflow(
        self, authenticated_client, workflow_service, other_user
    ):
        other_workflow = await workflow_service.create(
            user_id=other_user.id,
            name="Other User Workflow",
            description="",
        )

        response = await authenticated_client.put(
            f"/workflows/{other_workflow.id}/name", json={"name": "Hacked Name"}
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_run_other_user_workflow(
        self, authenticated_client, workflow_service, other_user, sample_workflow_data
    ):
        other_workflow = await workflow_service.create(
            user_id=other_user.id,
            name="Other User Workflow",
            description="",
        )
        await workflow_service.create_version(
            workflow=other_workflow,
            user_id=other_user.id,
            workflow_data=sample_workflow_data,
            base_version_id=None,
            message="Initial version",
        )

        response = await authenticated_client.post(f"/workflows/{other_workflow.id}/run")
        assert response.status_code == 403


class TestWorkflowPersistence:
    @pytest.mark.asyncio
    async def test_create_version_persists_latest_pointer(
        self,
        workflow_service,
        sample_workflow,
        test_db,
        test_user,
        sample_workflow_data,
    ):
        latest = await workflow_service.get_latest_version(sample_workflow)
        created = await workflow_service.create_version(
            workflow=sample_workflow,
            user_id=test_user.id,
            workflow_data=sample_workflow_data,
            base_version_id=latest.id,
            message="Persisted version",
        )

        await test_db.refresh(sample_workflow)
        assert sample_workflow.latest_version_id == created.id

        result = await test_db.exec(
            select(WorkflowVersion).where(WorkflowVersion.id == created.id)
        )
        persisted = result.first()
        assert persisted.version == 2

    @pytest.mark.asyncio
    async def test_delete_removes_workflow_shell(self, workflow_service, sample_workflow, test_db):
        workflow_id = sample_workflow.id

        await workflow_service.delete(sample_workflow)

        result = await test_db.exec(select(Workflow).where(Workflow.id == workflow_id))
        assert result.first() is None
