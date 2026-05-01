"""API integration tests for POST /webhook/{guid}."""

import pytest
from sqlmodel import select

from src.db.models import Execution
from test.webhook.fixtures import (  # noqa: F401  — register fixtures
    active_webhook_workflow,
    inactive_webhook_workflow,
    workflow_service,
)


class TestWebhookTriggerAPI:
    @pytest.mark.asyncio
    async def test_trigger_active_webhook_returns_202(
        self, client, active_webhook_workflow
    ):
        _, guid = active_webhook_workflow
        response = await client.post(f"/webhook/{guid}", json={})
        assert response.status_code == 202
        assert response.content == b""

    @pytest.mark.asyncio
    async def test_trigger_with_json_body_returns_202(
        self, client, active_webhook_workflow
    ):
        _, guid = active_webhook_workflow
        response = await client.post(
            f"/webhook/{guid}",
            json={"event": "order.created", "order_id": 42},
        )
        assert response.status_code == 202

    @pytest.mark.asyncio
    async def test_trigger_no_body_returns_202(self, client, active_webhook_workflow):
        _, guid = active_webhook_workflow
        response = await client.post(f"/webhook/{guid}")
        assert response.status_code == 202

    @pytest.mark.asyncio
    async def test_trigger_unknown_guid_returns_404(self, client):
        response = await client.post(
            "/webhook/00000000-0000-0000-0000-000000000000", json={}
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_trigger_inactive_webhook_returns_404(
        self, client, inactive_webhook_workflow
    ):
        _, guid = inactive_webhook_workflow
        response = await client.post(f"/webhook/{guid}", json={})
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_trigger_publishes_execution_to_db(
        self, client, test_db, active_webhook_workflow
    ):
        wf, guid = active_webhook_workflow
        response = await client.post(f"/webhook/{guid}", json={"key": "value"})
        assert response.status_code == 202

        stmt = select(Execution).where(Execution.workflow_id == wf.id)
        execution = (await test_db.exec(stmt)).first()
        assert execution is not None
        assert execution.workflow_id == wf.id

    @pytest.mark.asyncio
    async def test_trigger_does_not_require_authentication(
        self, client, active_webhook_workflow
    ):
        """Webhook endpoint must be publicly accessible (no auth cookies needed)."""
        _, guid = active_webhook_workflow
        # `client` fixture has no auth cookies set — same as anonymous caller
        response = await client.post(f"/webhook/{guid}", json={})
        assert response.status_code == 202
