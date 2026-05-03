"""Fixtures for webhook API tests."""

import pytest_asyncio
from sqlmodel import select

from src.db.models import WebhookRegistration
from src.workflow.service import WorkflowService

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


@pytest_asyncio.fixture(scope="function")
async def workflow_service(test_db):
    return WorkflowService(db=test_db)


@pytest_asyncio.fixture(scope="function")
async def active_webhook_workflow(workflow_service, test_db, test_user):
    """Published, active workflow with a webhook node. Returns (workflow, guid)."""
    wf = await workflow_service.create(
        user_id=test_user.id, name="Webhook WF", description=""
    )
    await workflow_service.create_version(
        workflow=wf,
        user_id=test_user.id,
        workflow_data=WEBHOOK_WORKFLOW_DATA,
        base_version_id=None,
    )
    await test_db.refresh(wf)
    wf = await workflow_service.update_status(wf, is_active=True)

    stmt = select(WebhookRegistration).where(WebhookRegistration.workflow_id == wf.id)
    reg = (await test_db.exec(stmt)).first()
    return wf, reg.guid


@pytest_asyncio.fixture(scope="function")
async def inactive_webhook_workflow(workflow_service, test_db, test_user):
    """Workflow with webhook node that has been deactivated. Returns (workflow, guid)."""
    wf = await workflow_service.create(
        user_id=test_user.id, name="Inactive Webhook WF", description=""
    )
    await workflow_service.create_version(
        workflow=wf,
        user_id=test_user.id,
        workflow_data=WEBHOOK_WORKFLOW_DATA,
        base_version_id=None,
    )
    await test_db.refresh(wf)
    wf = await workflow_service.update_status(wf, is_active=True)

    stmt = select(WebhookRegistration).where(WebhookRegistration.workflow_id == wf.id)
    reg = (await test_db.exec(stmt)).first()
    guid = reg.guid

    wf = await workflow_service.update_status(wf, is_active=False)
    return wf, guid
