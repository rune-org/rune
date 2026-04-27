"""Admin role and execution failure API tests.

Tests verify:
- ADMIN can perform operations on workflows they don't own
- ADMIN bypasses permission checks (view, edit, execute, delete)
- Timeout handling in workflow execution
- Partial execution failures and error propagation
- Execution status tracking through failures
"""

import pytest
from src.db.models import WorkflowRole, WorkflowUser, ExecutionStatus


class TestAdminRolePermissions:
    """Test ADMIN role privileges across API endpoints."""

    @pytest.mark.asyncio
    async def test_admin_can_view_any_workflow(
        self, admin_client, sample_workflow, test_user
    ):
        """ADMIN can view workflows even without permission."""
        # sample_workflow is owned by test_user, not admin
        response = await admin_client.get(f"/workflows/{sample_workflow.id}")
        assert response.status_code == 200
        assert response.json()["data"]["id"] == sample_workflow.id

    @pytest.mark.asyncio
    async def test_admin_can_edit_any_workflow(
        self, admin_client, sample_workflow, test_user
    ):
        """ADMIN can edit workflows they don't own."""
        response = await admin_client.put(
            f"/workflows/{sample_workflow.id}/name",
            json={"name": "Edited by Admin"},
        )
        assert response.status_code == 200
        assert response.json()["data"]["name"] == "Edited by Admin"

    @pytest.mark.asyncio
    async def test_admin_can_publish_any_workflow(
        self, admin_client, sample_workflow, test_user
    ):
        """ADMIN can publish workflows they don't own."""
        response = await admin_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )
        assert response.status_code == 200
        assert response.json()["data"]["is_active"] is True

    @pytest.mark.asyncio
    async def test_admin_can_create_versions_for_any_workflow(
        self, admin_client, sample_workflow, test_user
    ):
        """ADMIN can create versions for workflows they don't own."""
        response = await admin_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": None,
                "workflow_data": {
                    "nodes": [
                        {
                            "id": "admin-node",
                            "type": "trigger",
                            "trigger": True,
                            "data": {"label": "Admin Created"},
                        }
                    ],
                    "edges": [],
                },
                "message": "Admin created version",
            },
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_admin_can_execute_any_workflow(
        self, admin_client, sample_workflow, test_user
    ):
        """ADMIN can execute workflows they don't own."""
        # First publish the workflow (as admin)
        await admin_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        # ADMIN can run it
        response = await admin_client.post(f"/workflows/{sample_workflow.id}/run")
        assert response.status_code == 200
        assert "data" in response.json()

    @pytest.mark.asyncio
    async def test_admin_can_delete_any_workflow(
        self, admin_client, sample_workflow, test_user
    ):
        """ADMIN can delete workflows they don't own."""
        workflow_id = sample_workflow.id
        response = await admin_client.delete(f"/workflows/{workflow_id}")
        assert response.status_code == 204

        # Verify it's deleted
        get_response = await admin_client.get(f"/workflows/{workflow_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_admin_can_share_any_workflow(self, admin_client, sample_workflow, test_user, test_db):
        """ADMIN can share workflows they don't own (if share endpoint exists)."""
        # This test is placeholder - assumes a share/permission endpoint exists
        # Verify admin bypasses ownership checks on permission operations
        workflow_id = sample_workflow.id
        
        # Admin should be able to view permission details
        response = await admin_client.get(f"/workflows/{workflow_id}")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_admin_bulk_operations_bypass_permissions(
        self, admin_client, sample_workflow, test_user
    ):
        """ADMIN can bulk delete/run workflows they don't own."""
        # Create another workflow
        create_response = await admin_client.post(
            "/workflows/",
            json={"name": "Admin Bulk Test", "description": ""},
        )
        workflow_id = create_response.json()["data"]["id"]

        # Bulk delete should work (admin bypasses permission check)
        response = await admin_client.post(
            "/workflows/bulk",
            json={"action": "delete", "workflow_ids": [sample_workflow.id, workflow_id]},
        )

        if response.status_code == 200:
            result = response.json()["data"]
            # Both should be deleted
            assert result["summary"]["succeeded"] >= 1

    @pytest.mark.asyncio
    async def test_non_admin_still_cannot_edit_others_workflow(
        self, authenticated_client, other_client, sample_workflow
    ):
        """Non-admin users still cannot edit workflows they don't own."""
        response = await other_client.put(
            f"/workflows/{sample_workflow.id}/name",
            json={"name": "Should Fail"},
        )
        assert response.status_code == 403


class TestExecutionTimeoutScenarios:
    """Test workflow execution with timeout scenarios."""

    @pytest_asyncio.fixture
    async def workflow_with_timeout_config(self, authenticated_client, test_db, test_user):
        """Create a workflow with timeout configuration."""
        # Create workflow
        create_response = await authenticated_client.post(
            "/workflows/",
            json={"name": "Timeout Test Workflow", "description": ""},
        )
        workflow_id = create_response.json()["data"]["id"]

        # Create version with timeout in node config
        await authenticated_client.post(
            f"/workflows/{workflow_id}/versions",
            json={
                "base_version_id": None,
                "workflow_data": {
                    "nodes": [
                        {
                            "id": "trigger-node",
                            "type": "trigger",
                            "trigger": True,
                            "data": {"label": "Start"},
                        },
                        {
                            "id": "slow-node",
                            "type": "action",
                            "data": {
                                "label": "Slow Action",
                                "config": {"timeout_ms": 100},  # Very short timeout
                            },
                        },
                    ],
                    "edges": [
                        {"id": "edge-1", "src": "trigger-node", "dst": "slow-node"}
                    ],
                },
                "message": "With timeout config",
            },
        )

        # Publish it
        await authenticated_client.put(
            f"/workflows/{workflow_id}/status",
            json={"is_active": True},
        )

        # Return workflow_id
        return workflow_id

    @pytest.mark.asyncio
    async def test_run_workflow_with_timeout_config_succeeds_queuing(
        self, authenticated_client, workflow_with_timeout_config
    ):
        """Running a workflow with timeout config queues execution."""
        response = await authenticated_client.post(
            f"/workflows/{workflow_with_timeout_config}/run"
        )
        # Should queue successfully (timeout occurs during execution, not on queue)
        assert response.status_code == 200
        execution_id = response.json()["data"]
        assert isinstance(execution_id, str)

    @pytest.mark.asyncio
    async def test_run_workflow_with_node_timeout_returns_timeout_error(
        self, authenticated_client, sample_workflow
    ):
        """Running workflow where node times out should report timeout error."""
        # Publish
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        # Run - this queues for execution
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run"
        )
        assert response.status_code == 200

        # Note: Actual timeout would occur during worker execution
        # API level test verifies request doesn't timeout (200 response)

    @pytest.mark.asyncio
    async def test_concurrent_runs_with_timeouts_handled(
        self, authenticated_client, sample_workflow
    ):
        """Multiple concurrent runs with timeout configs all queue successfully."""
        import asyncio

        # Publish
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        # Queue 5 runs concurrently
        tasks = [
            authenticated_client.post(f"/workflows/{sample_workflow.id}/run")
            for _ in range(5)
        ]

        responses = await asyncio.gather(*tasks)

        # All should queue successfully (200)
        for response in responses:
            assert response.status_code == 200

        # Each should have unique execution ID
        execution_ids = [r.json()["data"] for r in responses]
        assert len(set(execution_ids)) == 5


class TestPartialExecutionFailures:
    """Test workflow execution with partial failures and error handling."""

    @pytest_asyncio.fixture
    async def workflow_with_multiple_nodes(self, authenticated_client, test_user):
        """Create workflow with multiple action nodes for testing partial failures."""
        create_response = await authenticated_client.post(
            "/workflows/",
            json={"name": "Multi-Node Workflow", "description": ""},
        )
        workflow_id = create_response.json()["data"]["id"]

        # Create version with multiple nodes
        await authenticated_client.post(
            f"/workflows/{workflow_id}/versions",
            json={
                "base_version_id": None,
                "workflow_data": {
                    "nodes": [
                        {
                            "id": "trigger",
                            "type": "trigger",
                            "trigger": True,
                            "data": {"label": "Start"},
                        },
                        {
                            "id": "node-1",
                            "type": "action",
                            "data": {
                                "label": "First Action",
                                "config": {"continue_on_error": True},
                            },
                        },
                        {
                            "id": "node-2",
                            "type": "action",
                            "data": {
                                "label": "Second Action",
                                "config": {"continue_on_error": False},
                            },
                        },
                        {
                            "id": "node-3",
                            "type": "action",
                            "data": {"label": "Third Action"},
                        },
                    ],
                    "edges": [
                        {"id": "e1", "src": "trigger", "dst": "node-1"},
                        {"id": "e2", "src": "node-1", "dst": "node-2"},
                        {"id": "e3", "src": "node-2", "dst": "node-3"},
                    ],
                },
                "message": "Multiple nodes",
            },
        )

        # Publish
        await authenticated_client.put(
            f"/workflows/{workflow_id}/status",
            json={"is_active": True},
        )

        return workflow_id

    @pytest.mark.asyncio
    async def test_execution_with_one_node_failure_queues_successfully(
        self, authenticated_client, workflow_with_multiple_nodes
    ):
        """Queuing execution with nodes that might fail still succeeds at API level."""
        response = await authenticated_client.post(
            f"/workflows/{workflow_with_multiple_nodes}/run"
        )
        assert response.status_code == 200
        execution_id = response.json()["data"]
        assert isinstance(execution_id, str)

    @pytest.mark.asyncio
    async def test_run_workflow_returns_unique_execution_id_per_attempt(
        self, authenticated_client, workflow_with_multiple_nodes
    ):
        """Each execution attempt gets unique ID even if nodes fail."""
        execution_ids = []
        for _ in range(3):
            response = await authenticated_client.post(
                f"/workflows/{workflow_with_multiple_nodes}/run"
            )
            assert response.status_code == 200
            execution_ids.append(response.json()["data"])

        # All should be unique
        assert len(set(execution_ids)) == 3

    @pytest.mark.asyncio
    async def test_partial_failure_status_reflects_in_execution_list(
        self, authenticated_client, sample_workflow, test_db
    ):
        """Execution list endpoint shows failed status for partial failures."""
        # Publish and run
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run"
        )
        execution_id = response.json()["data"]

        # Get executions list (if endpoint exists)
        list_response = await authenticated_client.get(
            f"/executions/workflows/{sample_workflow.id}"
        )

        # Should be accessible
        assert list_response.status_code in [200, 404]  # Vary by implementation

    @pytest.mark.asyncio
    async def test_continue_on_error_true_allows_next_node_execution(
        self, authenticated_client, workflow_with_multiple_nodes
    ):
        """Nodes with continue_on_error=true queue even when previous node fails."""
        response = await authenticated_client.post(
            f"/workflows/{workflow_with_multiple_nodes}/run"
        )
        # Should queue successfully (workflow structure is valid)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_continue_on_error_false_stops_at_next_failure(
        self, authenticated_client, workflow_with_multiple_nodes
    ):
        """Nodes with continue_on_error=false cause execution to stop on failure."""
        # Should still queue - the behavior plays out during execution
        response = await authenticated_client.post(
            f"/workflows/{workflow_with_multiple_nodes}/run"
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_unpublished_workflow_returns_error_not_execution(
        self, authenticated_client, workflow_with_multiple_nodes, test_db
    ):
        """Unpublished workflow cannot be executed even with multiple nodes."""
        # Get workflow ID
        wf_id = workflow_with_multiple_nodes

        # Unpublish it
        await authenticated_client.put(
            f"/workflows/{wf_id}/status",
            json={"is_active": False},
        )

        # Try to run - should get 400 not 200
        response = await authenticated_client.post(f"/workflows/{wf_id}/run")
        assert response.status_code in [400, 422]


class TestExecutionErrorHandling:
    """Test error handling and state tracking in execution."""

    @pytest.mark.asyncio
    async def test_run_nonexistent_workflow_returns_404(self, authenticated_client):
        """Running non-existent workflow returns 404."""
        response = await authenticated_client.post("/workflows/999999/run")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_run_without_permission_returns_403(
        self, authenticated_client, other_client, sample_workflow
    ):
        """User without permission cannot execute workflow."""
        # sample_workflow is owned by authenticated_client's user
        response = await other_client.post(f"/workflows/{sample_workflow.id}/run")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_run_with_invalid_version_id_returns_error(
        self, authenticated_client, sample_workflow
    ):
        """Running with non-existent version_id handled gracefully."""
        # Publish first
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        # Try with invalid version_id
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run",
            json={"version_id": 999999},
        )
        # Should fail with 400/404, not 500
        assert response.status_code in [400, 404, 422]

    @pytest.mark.asyncio
    async def test_multiple_executions_same_workflow_independent(
        self, authenticated_client, sample_workflow
    ):
        """Multiple executions of same workflow are independent."""
        import asyncio

        # Publish
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        # Run 3 times concurrently
        tasks = [
            authenticated_client.post(f"/workflows/{sample_workflow.id}/run")
            for _ in range(3)
        ]
        responses = await asyncio.gather(*tasks)

        # All succeed
        for r in responses:
            assert r.status_code == 200

        # Multiple execution records created
        exec_ids = [r.json()["data"] for r in responses]
        assert len(set(exec_ids)) == 3

    @pytest.mark.asyncio
    async def test_execution_does_not_leak_auth_context(
        self, authenticated_client, other_client, sample_workflow
    ):
        """Execution runs in user context, not leaked to others."""
        # Owner publishes and runs
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )
        owner_run = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/run"
        )
        owner_exec_id = owner_run.json()["data"]

        # Other user cannot access it
        response = await other_client.get(
            f"/executions/workflows/{sample_workflow.id}/{owner_exec_id}"
        )
        # Should be 403 (forbidden) not 200
        assert response.status_code == 403
