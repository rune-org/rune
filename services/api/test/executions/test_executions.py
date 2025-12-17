"""API tests for executions endpoints.

Tests cover:
1. Authentication requirements
2. Permission checks (OWNER, VIEWER, no access)
3. Queue message publishing and structure validation
4. Endpoint response verification
"""

import json
import pytest


class TestExecutionsAuthentication:
    """Tests for API authentication requirements."""

    @pytest.mark.asyncio
    async def test_get_executions_requires_auth(self, client, sample_workflow):
        """Should reject unauthenticated request for all executions."""
        response = await client.get(f"/workflows/{sample_workflow.id}/executions")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_specific_execution_requires_auth(self, client, sample_workflow):
        """Should reject unauthenticated request for specific execution."""
        response = await client.get(
            f"/workflows/{sample_workflow.id}/executions/exec_test123"
        )
        assert response.status_code == 401


class TestExecutionsNotFound:
    """Tests for 404 scenarios."""

    @pytest.mark.asyncio
    async def test_get_executions_workflow_not_found(self, authenticated_client):
        """Should return 404 for non-existent workflow."""
        response = await authenticated_client.get("/workflows/99999/executions")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_specific_execution_workflow_not_found(
        self, authenticated_client
    ):
        """Should return 404 for non-existent workflow."""
        response = await authenticated_client.get(
            "/workflows/99999/executions/exec_test123"
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
            f"/workflows/{sample_workflow.id}/executions"
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_owner_can_access_specific_execution(
        self, authenticated_client, sample_workflow
    ):
        """OWNER should be able to access specific execution."""
        response = await authenticated_client.get(
            f"/workflows/{sample_workflow.id}/executions/exec_test123"
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_viewer_can_access_executions(
        self, viewer_client, workflow_with_viewer
    ):
        """VIEWER should be able to access all executions (view permission)."""
        response = await viewer_client.get(
            f"/workflows/{workflow_with_viewer.id}/executions"
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_viewer_can_access_specific_execution(
        self, viewer_client, workflow_with_viewer
    ):
        """VIEWER should be able to access specific execution (view permission)."""
        response = await viewer_client.get(
            f"/workflows/{workflow_with_viewer.id}/executions/exec_test123"
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_no_access_user_denied_executions(
        self, other_client, sample_workflow
    ):
        """User without workflow access should be denied."""
        response = await other_client.get(f"/workflows/{sample_workflow.id}/executions")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_no_access_user_denied_specific_execution(
        self, other_client, sample_workflow
    ):
        """User without workflow access should be denied specific execution."""
        response = await other_client.get(
            f"/workflows/{sample_workflow.id}/executions/exec_test123"
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
            f"/workflows/{sample_workflow.id}/executions"
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
            f"/workflows/{sample_workflow.id}/executions/exec_test123"
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
            f"/workflows/{sample_workflow.id}/executions"
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
            f"/workflows/{sample_workflow.id}/executions/{execution_id}"
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
        response = await other_client.get(f"/workflows/{sample_workflow.id}/executions")
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
            f"/workflows/{sample_workflow.id}/executions"
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
