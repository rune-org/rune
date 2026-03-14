"""Tests for the bulk workflow operations endpoint (POST /workflows/bulk).

Each test class focuses on a single concern:

- TestBulkAuthentication   — unauthenticated requests are rejected
- TestBulkValidation       — invalid payloads are rejected with 422
- TestBulkDelete           — `delete` action permission matrix
- TestBulkActivate         — `activate` action permission matrix
- TestBulkDeactivate       — `deactivate` action permission matrix
- TestBulkExport           — `export` action permission matrix + response shape
- TestBulkRun              — `run` action permission matrix + invalid-workflow edge case
- TestBulkAdminOverride    — admins bypass all role restrictions
- TestBulkPartialSuccess   — mixed IDs produce partial succeeded/failed lists
- TestBulkResponseStructure — response envelope & summary counts
"""

import pytest
import pytest_asyncio
from src.db.models import User, Workflow, WorkflowRole, WorkflowUser, WorkflowVersion

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

MINIMAL_WORKFLOW_DATA = {
    "nodes": [
        {
            "id": "node-1",
            "type": "trigger",
            "trigger": True,
            "data": {"label": "Start"},
        },
        {"id": "node-2", "type": "action", "data": {"label": "Action"}},
    ],
    "edges": [{"id": "edge-1", "src": "node-1", "dst": "node-2"}],
}

# Workflow data that lacks a trigger node — used to exercise the
# `invalid_workflow` failure reason in the `run` action.
NO_TRIGGER_WORKFLOW_DATA = {
    "nodes": [
        {"id": "node-1", "type": "action", "data": {"label": "Action Only"}},
    ],
    "edges": [],
}


async def _make_workflow(
    db,
    name: str,
    workflow_data: dict | None = None,
    user: User | None = None,
    published: bool = False,
) -> Workflow:
    """Create a workflow with an initial version.

    Args:
        db: Database session
        name: Workflow name
        workflow_data: Workflow definition (defaults to MINIMAL_WORKFLOW_DATA)
        user: User who creates the workflow
        published: If True, set the workflow as published (for run tests)
    """
    wf = Workflow(
        name=name,
        description="",
        is_active=False,
    )
    db.add(wf)
    await db.flush()

    # Create initial version
    version = WorkflowVersion(
        workflow_id=wf.id,
        version=1,
        workflow_data=workflow_data or MINIMAL_WORKFLOW_DATA,
        created_by=user.id if user else None,
        message="Initial version",
    )
    db.add(version)
    await db.flush()

    # Update workflow to reference the version
    wf.latest_version_id = version.id
    if published:
        wf.published_version_id = version.id
        wf.is_active = True
    await db.flush()

    return wf


async def _grant(
    db, workflow: Workflow, user: User, role: WorkflowRole, granted_by: User
) -> None:
    db.add(
        WorkflowUser(
            workflow_id=workflow.id,
            user_id=user.id,
            granted_by=granted_by.id,
            role=role,
        )
    )


@pytest_asyncio.fixture
async def owned_workflow_a(test_db, test_user):
    """A workflow that test_user OWNS (first of two for multi-select tests)."""
    wf = await _make_workflow(test_db, "Owned A", user=test_user, published=True)
    await _grant(test_db, wf, test_user, WorkflowRole.OWNER, granted_by=test_user)
    await test_db.commit()
    await test_db.refresh(wf)
    return wf


@pytest_asyncio.fixture
async def owned_workflow_b(test_db, test_user):
    """A second workflow that test_user OWNS."""
    wf = await _make_workflow(test_db, "Owned B", user=test_user, published=True)
    await _grant(test_db, wf, test_user, WorkflowRole.OWNER, granted_by=test_user)
    await test_db.commit()
    await test_db.refresh(wf)
    return wf


@pytest_asyncio.fixture
async def editor_workflow(test_db, test_user, other_user):
    """A workflow owned by other_user where test_user has EDITOR role."""
    wf = await _make_workflow(
        test_db, "Editor Workflow", user=other_user, published=True
    )
    await _grant(test_db, wf, other_user, WorkflowRole.OWNER, granted_by=other_user)
    await _grant(test_db, wf, test_user, WorkflowRole.EDITOR, granted_by=other_user)
    await test_db.commit()
    await test_db.refresh(wf)
    return wf


@pytest_asyncio.fixture
async def viewer_workflow(test_db, test_user, other_user):
    """A workflow owned by other_user where test_user has VIEWER role."""
    wf = await _make_workflow(
        test_db, "Viewer Workflow", user=other_user, published=True
    )
    await _grant(test_db, wf, other_user, WorkflowRole.OWNER, granted_by=other_user)
    await _grant(test_db, wf, test_user, WorkflowRole.VIEWER, granted_by=other_user)
    await test_db.commit()
    await test_db.refresh(wf)
    return wf


@pytest_asyncio.fixture
async def inaccessible_workflow(test_db, other_user):
    """A workflow owned by other_user with NO access granted to test_user."""
    wf = await _make_workflow(test_db, "Inaccessible", user=other_user, published=True)
    await _grant(test_db, wf, other_user, WorkflowRole.OWNER, granted_by=other_user)
    await test_db.commit()
    await test_db.refresh(wf)
    return wf


@pytest_asyncio.fixture
async def invalid_structure_workflow(test_db, test_user):
    """An OWNER workflow whose nodes contain no trigger — run should fail."""
    wf = await _make_workflow(
        test_db,
        "No Trigger",
        workflow_data=NO_TRIGGER_WORKFLOW_DATA,
        user=test_user,
        published=True,
    )
    await _grant(test_db, wf, test_user, WorkflowRole.OWNER, granted_by=test_user)
    await test_db.commit()
    await test_db.refresh(wf)
    return wf


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _bulk(action: str, *ids: int) -> dict:
    return {"workflow_ids": list(ids), "action": action}


# ---------------------------------------------------------------------------
# TestBulkAuthentication
# ---------------------------------------------------------------------------


class TestBulkAuthentication:
    """The /bulk endpoint must reject unauthenticated callers."""

    @pytest.mark.asyncio
    async def test_bulk_delete_requires_auth(self, client, owned_workflow_a):
        response = await client.post(
            "/workflows/bulk", json=_bulk("delete", owned_workflow_a.id)
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_bulk_activate_requires_auth(self, client, owned_workflow_a):
        response = await client.post(
            "/workflows/bulk", json=_bulk("activate", owned_workflow_a.id)
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_bulk_export_requires_auth(self, client, owned_workflow_a):
        response = await client.post(
            "/workflows/bulk", json=_bulk("export", owned_workflow_a.id)
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# TestBulkValidation
# ---------------------------------------------------------------------------


class TestBulkValidation:
    """Invalid request bodies must be rejected with 422."""

    @pytest.mark.asyncio
    async def test_empty_workflow_ids_rejected(self, authenticated_client):
        response = await authenticated_client.post(
            "/workflows/bulk", json={"workflow_ids": [], "action": "delete"}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_missing_action_rejected(
        self, authenticated_client, owned_workflow_a
    ):
        response = await authenticated_client.post(
            "/workflows/bulk", json={"workflow_ids": [owned_workflow_a.id]}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_action_rejected(
        self, authenticated_client, owned_workflow_a
    ):
        response = await authenticated_client.post(
            "/workflows/bulk",
            json={"workflow_ids": [owned_workflow_a.id], "action": "fly_to_moon"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_missing_workflow_ids_rejected(self, authenticated_client):
        response = await authenticated_client.post(
            "/workflows/bulk", json={"action": "delete"}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_negative_id_rejected(self, authenticated_client):
        response = await authenticated_client.post(
            "/workflows/bulk", json={"workflow_ids": [-1], "action": "delete"}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_zero_id_rejected(self, authenticated_client):
        response = await authenticated_client.post(
            "/workflows/bulk", json={"workflow_ids": [0], "action": "delete"}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_more_than_100_ids_rejected(self, authenticated_client):
        ids = list(range(1, 102))  # 101 items
        response = await authenticated_client.post(
            "/workflows/bulk", json={"workflow_ids": ids, "action": "delete"}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_duplicate_ids_are_deduplicated(
        self, authenticated_client, owned_workflow_a
    ):
        """Sending the same ID twice should not cause a double-delete or error."""
        response = await authenticated_client.post(
            "/workflows/bulk",
            json={
                "workflow_ids": [owned_workflow_a.id, owned_workflow_a.id],
                "action": "delete",
            },
        )
        # 200 with a single succeeded entry
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["succeeded"] == [owned_workflow_a.id]
        assert data["summary"]["total"] == 1  # deduplication happened


# ---------------------------------------------------------------------------
# TestBulkDelete
# ---------------------------------------------------------------------------


class TestBulkDelete:
    """The `delete` action requires OWNER role."""

    @pytest.mark.asyncio
    async def test_owner_can_delete_one(self, authenticated_client, owned_workflow_a):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("delete", owned_workflow_a.id)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert owned_workflow_a.id in data["succeeded"]
        assert data["failed"] == []

    @pytest.mark.asyncio
    async def test_owner_can_delete_multiple(
        self, authenticated_client, owned_workflow_a, owned_workflow_b
    ):
        response = await authenticated_client.post(
            "/workflows/bulk",
            json=_bulk("delete", owned_workflow_a.id, owned_workflow_b.id),
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert set(data["succeeded"]) == {owned_workflow_a.id, owned_workflow_b.id}
        assert data["failed"] == []

    @pytest.mark.asyncio
    async def test_editor_cannot_delete(self, authenticated_client, editor_workflow):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("delete", editor_workflow.id)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["succeeded"] == []
        assert len(data["failed"]) == 1
        assert data["failed"][0]["id"] == editor_workflow.id
        assert data["failed"][0]["reason"] == "forbidden"

    @pytest.mark.asyncio
    async def test_viewer_cannot_delete(self, authenticated_client, viewer_workflow):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("delete", viewer_workflow.id)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["succeeded"] == []
        assert data["failed"][0]["reason"] == "forbidden"

    @pytest.mark.asyncio
    async def test_no_access_returns_forbidden(
        self, authenticated_client, inaccessible_workflow
    ):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("delete", inaccessible_workflow.id)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["failed"][0]["reason"] == "forbidden"

    @pytest.mark.asyncio
    async def test_nonexistent_id_returns_not_found(self, authenticated_client):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("delete", 999999)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["failed"][0]["id"] == 999999
        assert data["failed"][0]["reason"] == "not_found"

    @pytest.mark.asyncio
    async def test_deleted_workflow_is_gone(
        self, authenticated_client, owned_workflow_a
    ):
        """After a successful bulk delete the workflow must no longer exist."""
        await authenticated_client.post(
            "/workflows/bulk", json=_bulk("delete", owned_workflow_a.id)
        )
        get_response = await authenticated_client.get(
            f"/workflows/{owned_workflow_a.id}"
        )
        assert get_response.status_code == 404


# ---------------------------------------------------------------------------
# TestBulkActivate
# ---------------------------------------------------------------------------


class TestBulkActivate:
    """The `activate` action requires OWNER or EDITOR role."""

    @pytest.mark.asyncio
    async def test_owner_can_activate(self, authenticated_client, owned_workflow_a):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("activate", owned_workflow_a.id)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert owned_workflow_a.id in data["succeeded"]

    @pytest.mark.asyncio
    async def test_editor_can_activate(self, authenticated_client, editor_workflow):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("activate", editor_workflow.id)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert editor_workflow.id in data["succeeded"]

    @pytest.mark.asyncio
    async def test_viewer_cannot_activate(self, authenticated_client, viewer_workflow):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("activate", viewer_workflow.id)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["succeeded"] == []
        assert data["failed"][0]["reason"] == "forbidden"

    @pytest.mark.asyncio
    async def test_activate_sets_is_active_true(
        self, authenticated_client, owned_workflow_a
    ):
        """After successful activate, the workflow should report is_active=True."""
        await authenticated_client.post(
            "/workflows/bulk", json=_bulk("activate", owned_workflow_a.id)
        )
        get_response = await authenticated_client.get(
            f"/workflows/{owned_workflow_a.id}"
        )
        assert get_response.json()["data"]["is_active"] is True

    @pytest.mark.asyncio
    async def test_activate_multiple_at_once(
        self, authenticated_client, owned_workflow_a, owned_workflow_b
    ):
        response = await authenticated_client.post(
            "/workflows/bulk",
            json=_bulk("activate", owned_workflow_a.id, owned_workflow_b.id),
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert set(data["succeeded"]) == {owned_workflow_a.id, owned_workflow_b.id}


# ---------------------------------------------------------------------------
# TestBulkDeactivate
# ---------------------------------------------------------------------------


class TestBulkDeactivate:
    """The `deactivate` action requires OWNER or EDITOR role."""

    @pytest.mark.asyncio
    async def test_owner_can_deactivate(self, authenticated_client, owned_workflow_a):
        # First activate so there's something meaningful to deactivate.
        await authenticated_client.post(
            "/workflows/bulk", json=_bulk("activate", owned_workflow_a.id)
        )
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("deactivate", owned_workflow_a.id)
        )
        assert response.status_code == 200
        assert owned_workflow_a.id in response.json()["data"]["succeeded"]

    @pytest.mark.asyncio
    async def test_editor_can_deactivate(self, authenticated_client, editor_workflow):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("deactivate", editor_workflow.id)
        )
        assert response.status_code == 200
        assert editor_workflow.id in response.json()["data"]["succeeded"]

    @pytest.mark.asyncio
    async def test_viewer_cannot_deactivate(
        self, authenticated_client, viewer_workflow
    ):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("deactivate", viewer_workflow.id)
        )
        assert response.status_code == 200
        assert response.json()["data"]["failed"][0]["reason"] == "forbidden"

    @pytest.mark.asyncio
    async def test_deactivate_sets_is_active_false(
        self, authenticated_client, owned_workflow_a
    ):
        """Activate first, then deactivate and check the DB-reflected value."""
        await authenticated_client.post(
            "/workflows/bulk", json=_bulk("activate", owned_workflow_a.id)
        )
        await authenticated_client.post(
            "/workflows/bulk", json=_bulk("deactivate", owned_workflow_a.id)
        )
        get_response = await authenticated_client.get(
            f"/workflows/{owned_workflow_a.id}"
        )
        assert get_response.json()["data"]["is_active"] is False


# ---------------------------------------------------------------------------
# TestBulkExport
# ---------------------------------------------------------------------------


class TestBulkExport:
    """The `export` action is allowed for OWNER, EDITOR, and VIEWER."""

    @pytest.mark.asyncio
    async def test_owner_can_export(self, authenticated_client, owned_workflow_a):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("export", owned_workflow_a.id)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert owned_workflow_a.id in data["succeeded"]

    @pytest.mark.asyncio
    async def test_editor_can_export(self, authenticated_client, editor_workflow):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("export", editor_workflow.id)
        )
        assert response.status_code == 200
        assert editor_workflow.id in response.json()["data"]["succeeded"]

    @pytest.mark.asyncio
    async def test_viewer_can_export(self, authenticated_client, viewer_workflow):
        """Viewers have read-only access; export should succeed."""
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("export", viewer_workflow.id)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert viewer_workflow.id in data["succeeded"]
        assert data["failed"] == []

    @pytest.mark.asyncio
    async def test_no_access_excluded_from_export(
        self, authenticated_client, inaccessible_workflow
    ):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("export", inaccessible_workflow.id)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["succeeded"] == []
        assert data["failed"][0]["reason"] == "forbidden"

    @pytest.mark.asyncio
    async def test_export_populates_exported_field(
        self, authenticated_client, owned_workflow_a
    ):
        """The `exported` list must contain full WorkflowDetail objects."""
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("export", owned_workflow_a.id)
        )
        data = response.json()["data"]
        assert data["exported"] is not None
        assert len(data["exported"]) == 1
        exported_wf = data["exported"][0]
        assert exported_wf["id"] == owned_workflow_a.id
        assert "latest_version" in exported_wf
        assert exported_wf["latest_version"] is not None
        assert "workflow_data" in exported_wf["latest_version"]
        assert "name" in exported_wf

    @pytest.mark.asyncio
    async def test_export_absent_for_non_export_actions(
        self, authenticated_client, owned_workflow_a
    ):
        """For non-export actions the `exported` field must be null."""
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("activate", owned_workflow_a.id)
        )
        data = response.json()["data"]
        assert data.get("exported") is None

    @pytest.mark.asyncio
    async def test_export_multiple_workflows(
        self, authenticated_client, owned_workflow_a, owned_workflow_b
    ):
        response = await authenticated_client.post(
            "/workflows/bulk",
            json=_bulk("export", owned_workflow_a.id, owned_workflow_b.id),
        )
        data = response.json()["data"]
        assert len(data["exported"]) == 2
        exported_ids = {e["id"] for e in data["exported"]}
        assert exported_ids == {owned_workflow_a.id, owned_workflow_b.id}


# ---------------------------------------------------------------------------
# TestBulkRun
# ---------------------------------------------------------------------------


class TestBulkRun:
    """The `run` action requires OWNER or EDITOR role."""

    @pytest.mark.asyncio
    async def test_owner_can_run(self, authenticated_client, owned_workflow_a):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("run", owned_workflow_a.id)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert owned_workflow_a.id in data["succeeded"]

    @pytest.mark.asyncio
    async def test_editor_can_run(self, authenticated_client, editor_workflow):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("run", editor_workflow.id)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert editor_workflow.id in data["succeeded"]

    @pytest.mark.asyncio
    async def test_viewer_cannot_run(self, authenticated_client, viewer_workflow):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("run", viewer_workflow.id)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["succeeded"] == []
        assert data["failed"][0]["reason"] == "forbidden"

    @pytest.mark.asyncio
    async def test_invalid_workflow_structure_reported(
        self, authenticated_client, invalid_structure_workflow
    ):
        """Workflow with no trigger node should appear in failed with `invalid_workflow`."""
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("run", invalid_structure_workflow.id)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["succeeded"] == []
        assert data["failed"][0]["id"] == invalid_structure_workflow.id
        assert data["failed"][0]["reason"] == "invalid_workflow"

    @pytest.mark.asyncio
    async def test_run_returns_action_name(
        self, authenticated_client, owned_workflow_a
    ):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("run", owned_workflow_a.id)
        )
        assert response.json()["data"]["action"] == "run"

    @pytest.mark.asyncio
    async def test_run_returns_execution_ids(
        self, authenticated_client, owned_workflow_a, owned_workflow_b
    ):
        """For the `run` action, executions dict maps workflow_id (as string key) to execution_id."""
        response = await authenticated_client.post(
            "/workflows/bulk",
            json=_bulk("run", owned_workflow_a.id, owned_workflow_b.id),
        )
        assert response.status_code == 200
        data = response.json()["data"]
        # Both should succeed
        assert owned_workflow_a.id in data["succeeded"]
        assert owned_workflow_b.id in data["succeeded"]
        # Executions dict should be populated with execution IDs (UUID strings)
        # Note: dict keys are strings after JSON serialization
        assert data["executions"] is not None
        assert str(owned_workflow_a.id) in data["executions"]
        assert str(owned_workflow_b.id) in data["executions"]
        # Check that execution IDs are non-empty strings (UUID format)
        exec_id_a = data["executions"][str(owned_workflow_a.id)]
        exec_id_b = data["executions"][str(owned_workflow_b.id)]
        assert isinstance(exec_id_a, str) and len(exec_id_a) > 0
        assert isinstance(exec_id_b, str) and len(exec_id_b) > 0
        # Execution IDs should be different
        assert exec_id_a != exec_id_b


# ---------------------------------------------------------------------------
# TestBulkAdminOverride
# ---------------------------------------------------------------------------


class TestBulkAdminOverride:
    """Admins bypass all per-workflow role restrictions."""

    @pytest.mark.asyncio
    async def test_admin_can_delete_any_workflow(
        self, admin_client, inaccessible_workflow
    ):
        """Admin should be able to delete a workflow they have no role in."""
        response = await admin_client.post(
            "/workflows/bulk", json=_bulk("delete", inaccessible_workflow.id)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert inaccessible_workflow.id in data["succeeded"]
        assert data["failed"] == []

    @pytest.mark.asyncio
    async def test_admin_can_activate_any_workflow(
        self, admin_client, inaccessible_workflow
    ):
        response = await admin_client.post(
            "/workflows/bulk", json=_bulk("activate", inaccessible_workflow.id)
        )
        assert response.status_code == 200
        assert inaccessible_workflow.id in response.json()["data"]["succeeded"]

    @pytest.mark.asyncio
    async def test_admin_can_export_any_workflow(
        self, admin_client, inaccessible_workflow
    ):
        response = await admin_client.post(
            "/workflows/bulk", json=_bulk("export", inaccessible_workflow.id)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert inaccessible_workflow.id in data["succeeded"]
        assert data["exported"] is not None


# ---------------------------------------------------------------------------
# TestBulkPartialSuccess
# ---------------------------------------------------------------------------


class TestBulkPartialSuccess:
    """Mixed selections of permitted / forbidden / missing IDs."""

    @pytest.mark.asyncio
    async def test_delete_partial_owner_and_viewer(
        self, authenticated_client, owned_workflow_a, viewer_workflow
    ):
        """Owned workflow is deleted; viewer workflow is forbidden."""
        response = await authenticated_client.post(
            "/workflows/bulk",
            json=_bulk("delete", owned_workflow_a.id, viewer_workflow.id),
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert owned_workflow_a.id in data["succeeded"]
        failed_ids = {f["id"] for f in data["failed"]}
        assert viewer_workflow.id in failed_ids
        failure = next(f for f in data["failed"] if f["id"] == viewer_workflow.id)
        assert failure["reason"] == "forbidden"

    @pytest.mark.asyncio
    async def test_delete_partial_with_nonexistent_id(
        self, authenticated_client, owned_workflow_a
    ):
        """One valid owned ID and one non-existent ID in the same request."""
        ghost_id = 999998
        response = await authenticated_client.post(
            "/workflows/bulk",
            json=_bulk("delete", owned_workflow_a.id, ghost_id),
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert owned_workflow_a.id in data["succeeded"]
        not_found = next(f for f in data["failed"] if f["id"] == ghost_id)
        assert not_found["reason"] == "not_found"

    @pytest.mark.asyncio
    async def test_export_mixed_viewer_and_inaccessible(
        self, authenticated_client, viewer_workflow, inaccessible_workflow
    ):
        """Viewer-role workflow is exported; inaccessible one is forbidden."""
        response = await authenticated_client.post(
            "/workflows/bulk",
            json=_bulk("export", viewer_workflow.id, inaccessible_workflow.id),
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert viewer_workflow.id in data["succeeded"]
        forbidden = next(
            f for f in data["failed"] if f["id"] == inaccessible_workflow.id
        )
        assert forbidden["reason"] == "forbidden"

    @pytest.mark.asyncio
    async def test_activate_mixed_owner_viewer_missing(
        self, authenticated_client, owned_workflow_a, viewer_workflow
    ):
        """Three-way mix: owned (succeeds), viewer (forbidden), ghost (not_found)."""
        ghost_id = 999997
        response = await authenticated_client.post(
            "/workflows/bulk",
            json=_bulk("activate", owned_workflow_a.id, viewer_workflow.id, ghost_id),
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert owned_workflow_a.id in data["succeeded"]
        failed_reasons = {f["id"]: f["reason"] for f in data["failed"]}
        assert failed_reasons[viewer_workflow.id] == "forbidden"
        assert failed_reasons[ghost_id] == "not_found"


# ---------------------------------------------------------------------------
# TestBulkResponseStructure
# ---------------------------------------------------------------------------


class TestBulkResponseStructure:
    """The response envelope and summary counts must always be correct."""

    @pytest.mark.asyncio
    async def test_executions_absent_for_non_run_actions(
        self, authenticated_client, owned_workflow_a
    ):
        """Only `run` action includes executions dict; others have None."""
        for action in ("delete", "activate", "deactivate", "export"):
            response = await authenticated_client.post(
                "/workflows/bulk", json=_bulk(action, owned_workflow_a.id)
            )
            assert response.status_code == 200
            data = response.json()["data"]
            # executions should be None (or absent) for non-run actions
            assert data.get("executions") is None, (
                f"executions should be None for {action}"
            )
            if action == "delete":
                break  # Workflow is deleted, can't test others on same fixture

    @pytest.mark.asyncio
    async def test_response_contains_top_level_fields(
        self, authenticated_client, owned_workflow_a
    ):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("delete", owned_workflow_a.id)
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert "message" in body
        data = body["data"]
        assert "action" in data
        assert "succeeded" in data
        assert "failed" in data
        assert "summary" in data

    @pytest.mark.asyncio
    async def test_summary_counts_match_lists(
        self, authenticated_client, owned_workflow_a, viewer_workflow
    ):
        response = await authenticated_client.post(
            "/workflows/bulk",
            json=_bulk("delete", owned_workflow_a.id, viewer_workflow.id),
        )
        data = response.json()["data"]
        summary = data["summary"]
        assert summary["total"] == 2
        assert summary["succeeded"] == len(data["succeeded"])
        assert summary["failed"] == len(data["failed"])
        assert summary["succeeded"] + summary["failed"] == summary["total"]

    @pytest.mark.asyncio
    async def test_action_field_reflects_requested_action(
        self, authenticated_client, owned_workflow_a
    ):
        for action in ("delete", "activate", "deactivate", "export"):
            # Re-create workflow for each iteration since delete removes it
            if action == "delete":
                response = await authenticated_client.post(
                    "/workflows/bulk", json=_bulk(action, owned_workflow_a.id)
                )
                assert response.json()["data"]["action"] == action
                break  # after delete the fixture is gone; test others separately

    @pytest.mark.asyncio
    async def test_action_field_activate(self, authenticated_client, owned_workflow_a):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("activate", owned_workflow_a.id)
        )
        assert response.json()["data"]["action"] == "activate"

    @pytest.mark.asyncio
    async def test_action_field_deactivate(
        self, authenticated_client, owned_workflow_a
    ):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("deactivate", owned_workflow_a.id)
        )
        assert response.json()["data"]["action"] == "deactivate"

    @pytest.mark.asyncio
    async def test_action_field_export(self, authenticated_client, owned_workflow_a):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("export", owned_workflow_a.id)
        )
        assert response.json()["data"]["action"] == "export"

    @pytest.mark.asyncio
    async def test_failed_items_contain_id_and_reason(
        self, authenticated_client, viewer_workflow
    ):
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("delete", viewer_workflow.id)
        )
        failure = response.json()["data"]["failed"][0]
        assert "id" in failure
        assert "reason" in failure
        assert isinstance(failure["id"], int)
        assert isinstance(failure["reason"], str)

    @pytest.mark.asyncio
    async def test_all_fail_still_returns_200(self, authenticated_client):
        """Even when every ID fails, HTTP status must be 200."""
        response = await authenticated_client.post(
            "/workflows/bulk", json=_bulk("delete", 999996, 999995)
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["succeeded"] == []
        assert data["summary"]["succeeded"] == 0
        assert data["summary"]["failed"] == 2
