"""End-to-end tests for the webhook trigger feature.

Flow under test:
  1. Create a workflow with a webhook trigger node  (authenticated API)
  2. Save a version                                 (authenticated API)
  3. Activate (publish) the workflow               (authenticated API)
  4. Retrieve the webhook GUID from the DB         (direct postgres query)
  5. POST to /webhook/{guid} without any auth      (anonymous HTTP)
  6. Assert 202 No Content
  7. Assert an Execution row was created           (authenticated API)
  8. Verify the webhook URL is stable across       (re-publish + re-check GUID)
     re-publishes
  9. Assert 404 after workflow deactivation        (anonymous HTTP)
"""

import pytest

WEBHOOK_WORKFLOW_DATA = {
    "nodes": [
        {
            "id": "trigger-1",
            "type": "webhook",
            "trigger": True,
            "name": "Webhook Trigger",
            "parameters": {},
            "output": {},
        },
        {
            "id": "action-1",
            "type": "action",
            "trigger": False,
            "name": "Do Something",
            "parameters": {},
            "output": {},
        },
    ],
    "edges": [{"id": "edge-1", "src": "trigger-1", "dst": "action-1"}],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def create_and_activate_webhook_workflow(auth_http) -> tuple[int, int]:
    """Create a workflow, save a version, activate it. Returns (workflow_id, version_id)."""
    r = await auth_http.post(
        "/workflows/",
        json={"name": "E2E Webhook Workflow", "description": "e2e test"},
    )
    assert r.status_code == 201, r.text
    workflow_id = r.json()["data"]["id"]

    r = await auth_http.post(
        f"/workflows/{workflow_id}/versions",
        json={"workflow_data": WEBHOOK_WORKFLOW_DATA, "base_version_id": None},
    )
    assert r.status_code == 201, r.text
    version_id = r.json()["data"]["id"]

    r = await auth_http.put(
        f"/workflows/{workflow_id}/status", json={"is_active": True}
    )
    assert r.status_code == 200, r.text

    return workflow_id, version_id


async def get_webhook_guid(pg_conn, workflow_id: int) -> str | None:
    """Query the webhook_registrations table directly."""
    row = await pg_conn.fetchrow(
        "SELECT guid, is_active FROM webhook_registrations WHERE workflow_id = $1",
        workflow_id,
    )
    return row


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestWebhookE2E:
    @pytest.mark.asyncio
    async def test_full_webhook_trigger_flow(self, auth_http, http, pg_conn):
        """Happy path: create → activate → POST anonymously → 202 → execution created."""
        workflow_id, _ = await create_and_activate_webhook_workflow(auth_http)

        # Registration should exist and be active
        row = await get_webhook_guid(pg_conn, workflow_id)
        assert row is not None, "No webhook_registration row found after activation"
        assert row["is_active"] is True
        guid = row["guid"]
        assert guid  # non-empty UUID

        # Trigger via anonymous POST
        resp = await http.post(
            f"/webhook/{guid}",
            json={"event": "order.created", "order_id": 99},
        )
        assert resp.status_code == 202
        assert resp.content == b""

        # Execution record must exist in DB (API triggers async worker — check DB directly)
        count = await pg_conn.fetchval(
            "SELECT COUNT(*) FROM executions WHERE workflow_id = $1",
            workflow_id,
        )
        assert count >= 1, f"Expected at least 1 execution row, got {count}"

    @pytest.mark.asyncio
    async def test_webhook_requires_no_authentication(self, auth_http, http, pg_conn):
        """The /webhook/{guid} endpoint must be publicly accessible."""
        workflow_id, _ = await create_and_activate_webhook_workflow(auth_http)
        row = await get_webhook_guid(pg_conn, workflow_id)
        guid = row["guid"]

        # http fixture has zero auth cookies — purely anonymous
        resp = await http.post(f"/webhook/{guid}", json={"ping": True})
        assert resp.status_code == 202

    @pytest.mark.asyncio
    async def test_webhook_with_empty_body(self, auth_http, http, pg_conn):
        """Empty body is accepted; trigger data will be {} under $trigger."""
        workflow_id, _ = await create_and_activate_webhook_workflow(auth_http)
        row = await get_webhook_guid(pg_conn, workflow_id)
        guid = row["guid"]

        resp = await http.post(f"/webhook/{guid}")
        assert resp.status_code == 202

    @pytest.mark.asyncio
    async def test_unknown_guid_returns_404(self, http):
        """Completely unknown GUID must return 404."""
        resp = await http.post(
            "/webhook/00000000-0000-0000-0000-000000000000", json={}
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_deactivated_workflow_returns_404(self, auth_http, http, pg_conn):
        """After deactivation the GUID is preserved but 404 is returned."""
        workflow_id, _ = await create_and_activate_webhook_workflow(auth_http)
        row = await get_webhook_guid(pg_conn, workflow_id)
        guid = row["guid"]

        # Deactivate
        r = await auth_http.put(
            f"/workflows/{workflow_id}/status", json={"is_active": False}
        )
        assert r.status_code == 200

        # Registration must still exist (GUID preserved) but inactive
        row_after = await get_webhook_guid(pg_conn, workflow_id)
        assert row_after is not None, "Registration was deleted on deactivation"
        assert row_after["guid"] == guid, "GUID changed on deactivation"
        assert row_after["is_active"] is False

        # POST must now return 404
        resp = await http.post(f"/webhook/{guid}", json={})
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_guid_stable_across_republish(self, auth_http, http, pg_conn):
        """Re-publishing must not regenerate the GUID."""
        workflow_id, version_id = await create_and_activate_webhook_workflow(auth_http)
        row_first = await get_webhook_guid(pg_conn, workflow_id)
        guid_first = row_first["guid"]

        # Save a new version and publish it
        r = await auth_http.post(
            f"/workflows/{workflow_id}/versions",
            json={
                "workflow_data": WEBHOOK_WORKFLOW_DATA,
                "base_version_id": version_id,
            },
        )
        assert r.status_code == 201, r.text
        new_version_id = r.json()["data"]["id"]

        r = await auth_http.post(
            f"/workflows/{workflow_id}/publish",
            json={"version_id": new_version_id},
        )
        assert r.status_code == 200, r.text

        row_second = await get_webhook_guid(pg_conn, workflow_id)
        assert row_second["guid"] == guid_first, "GUID changed after re-publish"

        # Original GUID still triggers the workflow
        resp = await http.post(f"/webhook/{guid_first}", json={"v": 2})
        assert resp.status_code == 202

    @pytest.mark.asyncio
    async def test_reactivation_restores_same_guid(self, auth_http, http, pg_conn):
        """Deactivate then reactivate — same GUID, same URL still works."""
        workflow_id, _ = await create_and_activate_webhook_workflow(auth_http)
        row = await get_webhook_guid(pg_conn, workflow_id)
        guid = row["guid"]

        await auth_http.put(
            f"/workflows/{workflow_id}/status", json={"is_active": False}
        )
        await auth_http.put(
            f"/workflows/{workflow_id}/status", json={"is_active": True}
        )

        row_after = await get_webhook_guid(pg_conn, workflow_id)
        assert row_after["guid"] == guid
        assert row_after["is_active"] is True

        resp = await http.post(f"/webhook/{guid}", json={"reactivated": True})
        assert resp.status_code == 202

    @pytest.mark.asyncio
    async def test_no_webhook_node_means_no_registration(self, auth_http, pg_conn):
        """A workflow without a webhook node must have no registration row."""
        r = await auth_http.post(
            "/workflows/",
            json={"name": "No Webhook WF", "description": ""},
        )
        assert r.status_code == 201
        workflow_id = r.json()["data"]["id"]

        r = await auth_http.post(
            f"/workflows/{workflow_id}/versions",
            json={
                "workflow_data": {
                    "nodes": [
                        {
                            "id": "t1",
                            "type": "ScheduledTrigger",
                            "trigger": True,
                            "name": "Scheduler",
                            "parameters": {"amount": 5, "unit": "minutes"},
                            "output": {},
                        },
                        {
                            "id": "a1",
                            "type": "action",
                            "trigger": False,
                            "name": "Act",
                            "parameters": {},
                            "output": {},
                        },
                    ],
                    "edges": [{"id": "e1", "src": "t1", "dst": "a1"}],
                },
                "base_version_id": None,
            },
        )
        assert r.status_code == 201

        await auth_http.put(
            f"/workflows/{workflow_id}/status", json={"is_active": True}
        )

        row = await get_webhook_guid(pg_conn, workflow_id)
        assert row is None, "Expected no registration for non-webhook workflow"
