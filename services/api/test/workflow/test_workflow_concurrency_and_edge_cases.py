"""Concurrency and edge case API tests.

Tests verify:
- Multiple concurrent requests handle properly
- Version conflicts detected
- Race conditions in publish/unpublish
- Cascading effects of operations
- Edge cases around workflow lifecycle
"""

import asyncio

import pytest


class TestConcurrentOperations:
    """Test handling of concurrent API requests."""

    @pytest.mark.asyncio
    async def test_concurrent_workflow_creation_by_same_user(
        self, authenticated_client
    ):
        """Creating multiple workflows concurrently succeeds."""
        tasks = [
            authenticated_client.post(
                "/workflows/",
                json={
                    "name": f"Concurrent Workflow {i}",
                    "description": f"Created concurrently {i}",
                },
            )
            for i in range(5)
        ]

        responses = await asyncio.gather(*tasks)

        # All should succeed
        for response in responses:
            assert response.status_code == 201

        # All should have different IDs
        ids = [r.json()["data"]["id"] for r in responses]
        assert len(ids) == len(set(ids))  # All unique

    @pytest.mark.asyncio
    async def test_concurrent_reads_dont_conflict(
        self, authenticated_client, sample_workflow
    ):
        """Multiple concurrent reads of same workflow succeed."""
        tasks = [
            authenticated_client.get(f"/workflows/{sample_workflow.id}")
            for _ in range(10)
        ]

        responses = await asyncio.gather(*tasks)

        # All should succeed
        for response in responses:
            assert response.status_code == 200

        # All should return same workflow ID
        ids = [r.json()["data"]["id"] for r in responses]
        assert all(id_ == sample_workflow.id for id_ in ids)

    @pytest.mark.asyncio
    async def test_concurrent_version_creation_detects_conflict(
        self, authenticated_client, sample_workflow
    ):
        """Two saves with the same stale base_version_id: one succeeds, one gets 409."""
        # Get latest version first
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        base_version_id = detail.json()["data"]["latest_version"]["id"]

        # First request succeeds and advances latest_version_id
        r1 = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": base_version_id,
                "workflow_data": {
                    "nodes": [
                        {
                            "id": "node-1",
                            "type": "trigger",
                            "trigger": True,
                            "data": {"label": "Start 0"},
                        }
                    ],
                    "edges": [],
                },
                "message": "Version attempt 0",
            },
        )
        # Second request uses the same (now stale) base_version_id → conflict
        r2 = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": base_version_id,
                "workflow_data": {
                    "nodes": [
                        {
                            "id": "node-1",
                            "type": "trigger",
                            "trigger": True,
                            "data": {"label": "Start 1"},
                        }
                    ],
                    "edges": [],
                },
                "message": "Version attempt 1",
            },
        )

        status_codes = sorted([r1.status_code, r2.status_code])
        assert 201 in status_codes  # First attempt succeeded
        assert 409 in status_codes  # Second attempt conflicted

    @pytest.mark.asyncio
    async def test_concurrent_publish_and_run(
        self, authenticated_client, sample_workflow
    ):
        """Publishing and running concurrently doesn't cause issues."""
        # Concurrent: publish and attempt to run (run should fail since not current version)
        tasks = [
            authenticated_client.put(
                f"/workflows/{sample_workflow.id}/status",
                json={"is_active": True},
            ),
            authenticated_client.post(f"/workflows/{sample_workflow.id}/run"),
        ]

        responses = await asyncio.gather(*tasks)

        # Publish should succeed
        assert responses[0].status_code == 200

        # Run might succeed or fail depending on timing, but shouldn't cause 500 error
        assert responses[1].status_code != 500


class TestRaceConditions:
    """Test handling of race condition scenarios."""

    @pytest.mark.asyncio
    async def test_delete_while_accessing_workflow(
        self, authenticated_client, client, test_user, test_db
    ):
        """Accessing workflow while being deleted handles gracefully."""
        # Create two workflows
        workflow1_response = await authenticated_client.post(
            "/workflows/",
            json={"name": "Workflow to Delete", "description": ""},
        )
        workflow1_id = workflow1_response.json()["data"]["id"]

        # Concurrent: delete and read
        delete_task = authenticated_client.delete(f"/workflows/{workflow1_id}")
        read_task = authenticated_client.get(f"/workflows/{workflow1_id}")

        delete_response, read_response = await asyncio.gather(
            delete_task, read_task, return_exceptions=True
        )

        # One might fail (404) but shouldn't be 500 error
        if isinstance(delete_response, Exception):
            raise delete_response
        if isinstance(read_response, Exception):
            raise read_response

        assert delete_response.status_code == 204
        # Read might get 404 (already deleted) or 200 (got before delete) or fail during retrieval
        assert read_response.status_code in [200, 404]

    @pytest.mark.asyncio
    async def test_unpublish_while_running(self, authenticated_client, sample_workflow):
        """Unpublishing while running workflow doesn't cause issues."""
        # Publish first
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        # Concurrent: unpublish and run
        tasks = [
            authenticated_client.put(
                f"/workflows/{sample_workflow.id}/status",
                json={"is_active": False},
            ),
            authenticated_client.post(f"/workflows/{sample_workflow.id}/run"),
        ]

        responses = await asyncio.gather(*tasks)

        # Both operations should complete without 500 error
        assert all(r.status_code != 500 for r in responses)


class TestEdgeCases:
    """Test edge cases in workflow lifecycle."""

    @pytest.mark.asyncio
    async def test_workflow_with_duplicate_node_ids_rejected(
        self, authenticated_client, sample_workflow
    ):
        """Workflow with duplicate node IDs should be rejected."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": None,
                "workflow_data": {
                    "nodes": [
                        {"id": "node-1", "type": "trigger", "trigger": True},
                        {"id": "node-1", "type": "action"},  # Duplicate ID
                    ],
                    "edges": [],
                },
                "message": "Duplicate nodes",
            },
        )
        # Should reject duplicates
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_workflow_with_self_referencing_edge_rejected(
        self, authenticated_client, sample_workflow
    ):
        """Edge connecting node to itself might be invalid."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": sample_workflow.latest_version_id,
                "workflow_data": {
                    "nodes": [
                        {"id": "node-1", "type": "trigger", "trigger": True},
                    ],
                    "edges": [
                        {
                            "id": "edge-1",
                            "src": "node-1",
                            "dst": "node-1",  # Self-reference
                        }
                    ],
                },
                "message": "Self-referencing edge",
            },
        )
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_publish_workflow_without_any_versions_fails(
        self, authenticated_client
    ):
        """Publishing workflow with no versions should fail."""
        # Create workflow shell without versions
        create_response = await authenticated_client.post(
            "/workflows/",
            json={"name": "Empty Shell", "description": ""},
        )
        workflow_id = create_response.json()["data"]["id"]

        # Try to publish without creating version
        response = await authenticated_client.put(
            f"/workflows/{workflow_id}/status",
            json={"is_active": True},
        )
        # Should fail since no version to publish
        assert response.status_code in [400, 404, 422]

    @pytest.mark.asyncio
    async def test_create_version_with_nonexistent_base_version_fails(
        self, authenticated_client, sample_workflow
    ):
        """Creating version based on non-existent base should fail."""
        response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": 999999,  # Non-existent
                "workflow_data": {
                    "nodes": [{"id": "node-1", "type": "trigger", "trigger": True}],
                    "edges": [],
                },
                "message": "Based on fake version",
            },
        )
        assert response.status_code in [400, 404, 409]

    @pytest.mark.asyncio
    async def test_restore_workflow_version_creates_new_version(
        self, authenticated_client, sample_workflow
    ):
        """Restoring a version should create a new version, not modify existing."""
        # Get the initial version
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        initial_version = detail.json()["data"]["latest_version"]["id"]

        # Create second version
        await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/versions",
            json={
                "base_version_id": initial_version,
                "workflow_data": {
                    "nodes": [
                        {
                            "id": "node-2",
                            "type": "trigger",
                            "trigger": True,
                            "data": {"label": "Modified"},
                        }
                    ],
                    "edges": [],
                },
                "message": "Version 2",
            },
        )

        # Restore first version
        restore_response = await authenticated_client.post(
            f"/workflows/{sample_workflow.id}/restore/{initial_version}",
            json={"message": "Rolled back to version 1"},
        )

        assert restore_response.status_code == 201

        # Restore created v3 (v1 initial, v2 modified, v3 restored copy of v1)
        detail = await authenticated_client.get(f"/workflows/{sample_workflow.id}")
        latest = detail.json()["data"]["latest_version"]
        assert latest["version"] == 3


class TestBulkOperations:
    """Test bulk operation edge cases."""

    @pytest.mark.asyncio
    async def test_bulk_run_mixed_valid_invalid_workflows(
        self, authenticated_client, sample_workflow
    ):
        """Bulk run with some valid and some invalid workflows returns partial success."""
        # Create workflow and publish it
        await authenticated_client.put(
            f"/workflows/{sample_workflow.id}/status",
            json={"is_active": True},
        )

        # Create unpublished workflow
        unpub_response = await authenticated_client.post(
            "/workflows/",
            json={"name": "Unpublished", "description": ""},
        )
        unpub_id = unpub_response.json()["data"]["id"]

        # Bulk run both
        response = await authenticated_client.post(
            "/workflows/bulk",
            json={
                "action": "run",
                "workflow_ids": [sample_workflow.id, unpub_id],
            },
        )

        assert response.status_code == 200
        result = response.json()["data"]
        # published workflow runs, unpublished one has no published version
        assert result["summary"]["total"] == 2
        assert result["summary"]["succeeded"] == 1
        assert result["summary"]["failed"] == 1

    @pytest.mark.asyncio
    async def test_bulk_delete_removes_all_specified(self, authenticated_client):
        """Bulk delete removes all specified workflows."""
        # Create 3 workflows
        ids = []
        for i in range(3):
            response = await authenticated_client.post(
                "/workflows/",
                json={"name": f"To Delete {i}", "description": ""},
            )
            ids.append(response.json()["data"]["id"])

        # Bulk delete
        response = await authenticated_client.post(
            "/workflows/bulk",
            json={"action": "delete", "workflow_ids": ids},
        )

        assert response.status_code == 200
        result = response.json()["data"]
        assert result["summary"]["succeeded"] == 3
        assert result["summary"]["failed"] == 0

        for wf_id in ids:
            get_response = await authenticated_client.get(f"/workflows/{wf_id}")
            assert get_response.status_code == 404
