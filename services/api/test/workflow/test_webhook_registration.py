"""Service-level tests for webhook registration lifecycle."""

import pytest
from sqlmodel import select

from src.db.models import WebhookRegistration


WEBHOOK_WORKFLOW_DATA = {
    "nodes": [
        {
            "id": "t1",
            "type": "webhook",
            "trigger": True,
            "name": "Webhook Trigger",
            "webhook_guid": "123e4567-e89b-12d3-a456-426614174000",
        },
        {"id": "a1", "type": "action", "trigger": False, "name": "Action"},
    ],
    "edges": [{"id": "e1", "src": "t1", "dst": "a1"}],
}

NO_WEBHOOK_WORKFLOW_DATA = {
    "nodes": [
        {
            "id": "t1",
            "type": "ScheduledTrigger",
            "trigger": True,
            "name": "Scheduler",
            "parameters": {"amount": 5, "unit": "minutes"},
        },
        {"id": "a1", "type": "action", "trigger": False, "name": "Action"},
    ],
    "edges": [{"id": "e1", "src": "t1", "dst": "a1"}],
}


async def _get_registration(db, workflow_id: int) -> WebhookRegistration | None:
    stmt = select(WebhookRegistration).where(
        WebhookRegistration.workflow_id == workflow_id
    )
    return (await db.exec(stmt)).first()


class TestWebhookRegistration:
    @pytest.mark.asyncio
    async def test_publish_with_webhook_node_creates_registration(
        self, workflow_service, test_db, test_user
    ):
        wf = await workflow_service.create(
            user_id=test_user.id, name="WH WF", description=""
        )
        await workflow_service.create_version(
            workflow=wf,
            user_id=test_user.id,
            workflow_data=WEBHOOK_WORKFLOW_DATA,
            base_version_id=None,
        )
        await test_db.refresh(wf)
        await workflow_service.update_status(wf, is_active=True)

        reg = await _get_registration(test_db, wf.id)
        assert reg is not None
        assert reg.is_active is True
        assert reg.guid  # non-empty UUID string

    @pytest.mark.asyncio
    async def test_publish_without_webhook_node_no_registration(
        self, workflow_service, test_db, test_user
    ):
        wf = await workflow_service.create(
            user_id=test_user.id, name="Sched WF", description=""
        )
        await workflow_service.create_version(
            workflow=wf,
            user_id=test_user.id,
            workflow_data=NO_WEBHOOK_WORKFLOW_DATA,
            base_version_id=None,
        )
        await test_db.refresh(wf)
        await workflow_service.update_status(wf, is_active=True)

        reg = await _get_registration(test_db, wf.id)
        assert reg is None

    @pytest.mark.asyncio
    async def test_deactivate_sets_is_active_false(
        self, workflow_service, test_db, test_user
    ):
        wf = await workflow_service.create(
            user_id=test_user.id, name="WH WF", description=""
        )
        await workflow_service.create_version(
            workflow=wf,
            user_id=test_user.id,
            workflow_data=WEBHOOK_WORKFLOW_DATA,
            base_version_id=None,
        )
        await test_db.refresh(wf)
        wf = await workflow_service.update_status(wf, is_active=True)
        wf = await workflow_service.update_status(wf, is_active=False)

        reg = await _get_registration(test_db, wf.id)
        assert reg is not None
        assert reg.is_active is False

    @pytest.mark.asyncio
    async def test_reactivate_sets_is_active_true_same_guid(
        self, workflow_service, test_db, test_user
    ):
        wf = await workflow_service.create(
            user_id=test_user.id, name="WH WF", description=""
        )
        await workflow_service.create_version(
            workflow=wf,
            user_id=test_user.id,
            workflow_data=WEBHOOK_WORKFLOW_DATA,
            base_version_id=None,
        )
        await test_db.refresh(wf)
        wf = await workflow_service.update_status(wf, is_active=True)
        reg_first = await _get_registration(test_db, wf.id)
        guid_before = reg_first.guid

        wf = await workflow_service.update_status(wf, is_active=False)
        wf = await workflow_service.update_status(wf, is_active=True)

        reg = await _get_registration(test_db, wf.id)
        assert reg is not None
        assert reg.is_active is True
        assert reg.guid == guid_before

    @pytest.mark.asyncio
    async def test_guid_is_stable_across_republishes(
        self, workflow_service, test_db, test_user
    ):
        wf = await workflow_service.create(
            user_id=test_user.id, name="WH WF", description=""
        )
        v1 = await workflow_service.create_version(
            workflow=wf,
            user_id=test_user.id,
            workflow_data=WEBHOOK_WORKFLOW_DATA,
            base_version_id=None,
        )
        await test_db.refresh(wf)
        wf = await workflow_service.update_status(wf, is_active=True)

        reg_first = await _get_registration(test_db, wf.id)
        guid_before = reg_first.guid

        # Save and publish a second version
        await workflow_service.create_version(
            workflow=wf,
            user_id=test_user.id,
            workflow_data=WEBHOOK_WORKFLOW_DATA,
            base_version_id=v1.id,
        )
        await test_db.refresh(wf)
        await workflow_service.publish_version(wf, wf.latest_version_id)

        reg = await _get_registration(test_db, wf.id)
        assert reg.guid == guid_before

    @pytest.mark.asyncio
    async def test_removing_webhook_node_deletes_registration(
        self, workflow_service, test_db, test_user
    ):
        wf = await workflow_service.create(
            user_id=test_user.id, name="WH WF", description=""
        )
        v1 = await workflow_service.create_version(
            workflow=wf,
            user_id=test_user.id,
            workflow_data=WEBHOOK_WORKFLOW_DATA,
            base_version_id=None,
        )
        await test_db.refresh(wf)
        wf = await workflow_service.update_status(wf, is_active=True)
        assert await _get_registration(test_db, wf.id) is not None

        # Publish new version without the webhook node
        await workflow_service.create_version(
            workflow=wf,
            user_id=test_user.id,
            workflow_data=NO_WEBHOOK_WORKFLOW_DATA,
            base_version_id=v1.id,
        )
        await test_db.refresh(wf)
        await workflow_service.publish_version(wf, wf.latest_version_id)

        assert await _get_registration(test_db, wf.id) is None

    @pytest.mark.asyncio
    async def test_workflow_delete_cascades_to_registration(
        self, workflow_service, test_db, test_user
    ):
        wf = await workflow_service.create(
            user_id=test_user.id, name="WH WF", description=""
        )
        await workflow_service.create_version(
            workflow=wf,
            user_id=test_user.id,
            workflow_data=WEBHOOK_WORKFLOW_DATA,
            base_version_id=None,
        )
        await test_db.refresh(wf)
        wf = await workflow_service.update_status(wf, is_active=True)
        wf_id = wf.id

        await workflow_service.delete(wf)

        stmt = select(WebhookRegistration).where(
            WebhookRegistration.workflow_id == wf_id
        )
        reg = (await test_db.exec(stmt)).first()
        assert reg is None
