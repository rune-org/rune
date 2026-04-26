"""API tests for executions endpoints.

Tests cover:
1. Authentication requirements
2. Permission checks (OWNER, VIEWER, no access)
3. Queue message publishing and structure validation
4. Endpoint response verification
5. List executions endpoint
"""

import json

import pytest


class TestExecutionsAuthentication:
    """Tests for API authentication requirements."""

    @pytest.mark.asyncio
    async def test_list_executions_requires_auth(self, client):
        """Should reject unauthenticated request for executions list."""
        response = await client.get("/executions/")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_executions_requires_auth(self, client, sample_workflow):
        """Should reject unauthenticated request for all executions."""
        response = await client.get(f"/executions/workflows/{sample_workflow.id}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_specific_execution_requires_auth(self, client, sample_workflow):
        """Should reject unauthenticated request for specific execution."""
        response = await client.get(
            f"/executions/workflows/{sample_workflow.id}/exec_test123"
        )
        assert response.status_code == 401


class TestExecutionsNotFound:
    """Tests for 404 scenarios."""

    @pytest.mark.asyncio
    async def test_get_executions_workflow_not_found(self, authenticated_client):
        """Should return 404 for non-existent workflow."""
        response = await authenticated_client.get("/executions/workflows/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_specific_execution_workflow_not_found(
        self, authenticated_client
    ):
        """Should return 404 for non-existent workflow."""
        response = await authenticated_client.get(
            "/executions/workflows/99999/exec_test123"
        )
        assert response.status_code == 404


class TestExecutionsPermissions:
    """Tests for permission checks."""

    @pytest.mark.asyncio
    async def test_owner_can_access_executions(
        self, authenticated_client, sample_workflow
    ):
        """OWNER should be able to access all executions."""
        response = await authenticated_client.get(
            f"/executions/workflows/{sample_workflow.id}"
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_owner_can_access_specific_execution(
        self, authenticated_client, sample_workflow
    ):
        """OWNER should be able to access specific execution."""
        response = await authenticated_client.get(
            f"/executions/workflows/{sample_workflow.id}/exec_test123"
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_viewer_can_access_executions(
        self, viewer_client, workflow_with_viewer
    ):
        """VIEWER should be able to access all executions (view permission)."""
        response = await viewer_client.get(
            f"/executions/workflows/{workflow_with_viewer.id}"
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_viewer_can_access_specific_execution(
        self, viewer_client, workflow_with_viewer
    ):
        """VIEWER should be able to access specific execution (view permission)."""
        response = await viewer_client.get(
            f"/executions/workflows/{workflow_with_viewer.id}/exec_test123"
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_no_access_user_denied_executions(
        self, other_client, sample_workflow
    ):
        """User without workflow access should be denied."""
        response = await other_client.get(f"/executions/workflows/{sample_workflow.id}")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_no_access_user_denied_specific_execution(
        self, other_client, sample_workflow
    ):
        """User without workflow access should be denied specific execution."""
        response = await other_client.get(
            f"/executions/workflows/{sample_workflow.id}/exec_test123"
        )
        assert response.status_code == 403


class TestExecutionsResponseStructure:
    """Tests for API response structures."""

    @pytest.mark.asyncio
    async def test_get_executions_response_structure(
        self, authenticated_client, sample_workflow
    ):
        """Should return proper success response structure."""
        response = await authenticated_client.get(
            f"/executions/workflows/{sample_workflow.id}"
        )

        data = response.json()
        assert data["success"] is True
        assert data["message"] == "Execution access granted"
        assert data["data"] is None

    @pytest.mark.asyncio
    async def test_get_specific_execution_response_structure(
        self, authenticated_client, sample_workflow
    ):
        """Should return proper success response structure."""
        response = await authenticated_client.get(
            f"/executions/workflows/{sample_workflow.id}/exec_test123"
        )

        data = response.json()
        assert data["success"] is True
        assert data["message"] == "Execution access granted"
        assert data["data"] is None


class TestExecutionsQueuePublishing:
    """Tests for queue message publishing and structure validation."""

    @pytest.mark.asyncio
    async def test_get_executions_publishes_wildcard_token(
        self, authenticated_client, sample_workflow, test_rabbitmq, test_settings
    ):
        """Should publish token with null execution_id for all executions."""
        # Purge any existing messages
        channel = await test_rabbitmq.channel()
        queue = await channel.declare_queue(
            test_settings.rabbitmq_token_queue, durable=True
        )
        await queue.purge()

        # Make request
        response = await authenticated_client.get(
            f"/executions/workflows/{sample_workflow.id}"
        )
        assert response.status_code == 200

        # Check queue for message
        message = await queue.get(timeout=5)
        assert message is not None

        # Validate message structure
        token = json.loads(message.body.decode("utf-8"))
        assert token["execution_id"] is None  # Wildcard
        assert token["workflow_id"] == str(sample_workflow.id)
        assert "user_id" in token
        assert "iat" in token
        assert "exp" in token
        assert isinstance(token["iat"], int)
        assert isinstance(token["exp"], int)
        assert token["exp"] > token["iat"]

        await channel.close()

    @pytest.mark.asyncio
    async def test_get_specific_execution_publishes_scoped_token(
        self, authenticated_client, sample_workflow, test_rabbitmq, test_settings
    ):
        """Should publish token with specific execution_id."""
        execution_id = "exec_specific_123"

        # Purge any existing messages
        channel = await test_rabbitmq.channel()
        queue = await channel.declare_queue(
            test_settings.rabbitmq_token_queue, durable=True
        )
        await queue.purge()

        # Make request
        response = await authenticated_client.get(
            f"/executions/workflows/{sample_workflow.id}/{execution_id}"
        )
        assert response.status_code == 200

        # Check queue for message
        message = await queue.get(timeout=5)
        assert message is not None

        # Validate message structure
        token = json.loads(message.body.decode("utf-8"))
        assert token["execution_id"] == execution_id  # Specific ID
        assert token["workflow_id"] == str(sample_workflow.id)
        assert "user_id" in token
        assert "iat" in token
        assert "exp" in token

        await channel.close()

    @pytest.mark.asyncio
    async def test_denied_request_does_not_publish_token(
        self, other_client, sample_workflow, test_rabbitmq, test_settings
    ):
        """Should NOT publish token when access is denied."""
        # Purge any existing messages
        channel = await test_rabbitmq.channel()
        queue = await channel.declare_queue(
            test_settings.rabbitmq_token_queue, durable=True
        )
        await queue.purge()

        # Make request (should be denied)
        response = await other_client.get(f"/executions/workflows/{sample_workflow.id}")
        assert response.status_code == 403

        # Verify no message was published
        message = await queue.get(timeout=1, fail=False)
        assert message is None

        await channel.close()

    @pytest.mark.asyncio
    async def test_token_timestamps_are_valid(
        self, authenticated_client, sample_workflow, test_rabbitmq, test_settings
    ):
        """Token timestamps should be valid Unix timestamps."""
        import time

        current_time = int(time.time())

        # Purge any existing messages
        channel = await test_rabbitmq.channel()
        queue = await channel.declare_queue(
            test_settings.rabbitmq_token_queue, durable=True
        )
        await queue.purge()

        # Make request
        response = await authenticated_client.get(
            f"/executions/workflows/{sample_workflow.id}"
        )
        assert response.status_code == 200

        # Check queue for message
        message = await queue.get(timeout=5)
        token = json.loads(message.body.decode("utf-8"))

        # iat should be close to current time (within 5 seconds)
        assert abs(token["iat"] - current_time) < 5

        # exp should be 1 hour (3600 seconds) after iat
        assert token["exp"] - token["iat"] == 3600

        await channel.close()


class TestListExecutions:
    """Tests for GET /executions/ list endpoint."""

    @pytest.mark.asyncio
    async def test_list_executions_returns_empty_list(self, authenticated_client):
        """Should return empty list when no executions exist."""
        response = await authenticated_client.get("/executions/")
        assert response.status_code == 200

        data = response.json()
        assert data["success"] is True
        assert data["message"] == "Executions retrieved"
        assert data["data"] == []

    @pytest.mark.asyncio
    async def test_list_executions_returns_user_executions(
        self, authenticated_client, sample_executions
    ):
        """Should return executions for workflows the user has access to."""
        response = await authenticated_client.get("/executions/")
        assert response.status_code == 200

        data = response.json()
        assert data["success"] is True
        assert len(data["data"]) == 3

    @pytest.mark.asyncio
    async def test_list_executions_item_structure(
        self, authenticated_client, sample_executions
    ):
        """Each execution item should have the expected fields."""
        response = await authenticated_client.get("/executions/")
        items = response.json()["data"]

        for item in items:
            assert "id" in item
            assert "workflow_id" in item
            assert "workflow_name" in item
            assert "status" in item
            assert "created_at" in item

    @pytest.mark.asyncio
    async def test_list_executions_no_access_returns_empty(
        self, other_client, sample_executions
    ):
        """User without workflow access should get empty list."""
        response = await other_client.get("/executions/")
        assert response.status_code == 200

        data = response.json()
        assert data["data"] == []

    @pytest.mark.asyncio
    async def test_list_executions_viewer_can_see(
        self, viewer_client, workflow_with_viewer, sample_executions
    ):
        """VIEWER should see executions for workflows they have access to."""
        response = await viewer_client.get("/executions/")
        assert response.status_code == 200

        data = response.json()
        assert len(data["data"]) == 3

    @pytest.mark.asyncio
    async def test_list_executions_includes_status(
        self, authenticated_client, sample_executions
    ):
        """Should include correct status values."""
        response = await authenticated_client.get("/executions/")
        items = response.json()["data"]
        statuses = {item["status"] for item in items}
        assert "completed" in statuses
        assert "pending" in statuses
        assert "failed" in statuses
