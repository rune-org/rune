"""Fixtures for scheduled workflow tests."""

import pytest
from datetime import datetime, timedelta
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import Workflow, WorkflowUser, WorkflowRole
from src.workflow.triggers import ScheduleTriggerService
from src.workflow.service import WorkflowService
from src.scheduler.service import ScheduledWorkflowService


@pytest.fixture(scope="function")
async def workflow_service(test_db: AsyncSession) -> WorkflowService:
    """Create a WorkflowService instance."""
    return WorkflowService(db=test_db)


@pytest.fixture(scope="function")
async def schedule_trigger_service(test_db: AsyncSession) -> ScheduleTriggerService:
    """Create a ScheduleTriggerService instance for API operations."""
    return ScheduleTriggerService(db=test_db)


# Fixture for daemon/execution tests - uses ScheduledWorkflowService
@pytest.fixture(scope="function")
async def scheduled_workflow_service(test_db: AsyncSession) -> ScheduledWorkflowService:
    """Create a ScheduledWorkflowService instance for daemon operations."""
    return ScheduledWorkflowService(db=test_db)


@pytest.fixture(scope="function")
async def workflow_with_trigger(test_db: AsyncSession, test_user) -> Workflow:
    """Create a workflow with a trigger node for scheduling."""
    workflow = Workflow(
        name="Test Workflow with Trigger",
        description="Workflow with trigger node for testing",
        workflow_data={
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "trigger": True,
                    "data": {"label": "Trigger"},
                },
                {"id": "action-1", "type": "action", "data": {"label": "Action"}},
            ],
            "edges": [{"src": "trigger-1", "dst": "action-1"}],
        },
        version=1,
        trigger_type=None,
    )
    test_db.add(workflow)
    await test_db.commit()
    await test_db.refresh(workflow)

    # Grant ownership to test user
    workflow_user = WorkflowUser(
        workflow_id=workflow.id,
        user_id=test_user.id,
        role=WorkflowRole.OWNER,
        granted_by=test_user.id,
    )
    test_db.add(workflow_user)
    await test_db.commit()

    return workflow


@pytest.fixture(scope="function")
async def multiple_workflows_with_triggers(
    test_db: AsyncSession, test_user
) -> list[Workflow]:
    """Create 3 workflows with triggers (optimized for speed)."""
    workflows = []
    for i in range(3):  # Reduced from 5 for faster tests
        workflow = Workflow(
            name=f"Test Workflow {i + 1}",
            description=f"Test workflow {i + 1}",
            workflow_data={
                "nodes": [
                    {
                        "id": f"trigger-{i}",
                        "type": "trigger",
                        "trigger": True,
                        "data": {"label": "Trigger"},
                    },
                    {
                        "id": f"action-{i}",
                        "type": "action",
                        "data": {"label": "Action"},
                    },
                ],
                "edges": [{"src": f"trigger-{i}", "dst": f"action-{i}"}],
            },
            version=1,
            trigger_type=None,
        )
        test_db.add(workflow)
        await test_db.commit()
        await test_db.refresh(workflow)

        # Grant ownership
        workflow_user = WorkflowUser(
            workflow_id=workflow.id,
            user_id=test_user.id,
            role=WorkflowRole.OWNER,
            granted_by=test_user.id,
        )
        test_db.add(workflow_user)
        await test_db.commit()

        workflows.append(workflow)

    return workflows


@pytest.fixture(scope="function")
async def overdue_workflow_schedule(
    workflow_with_trigger: Workflow,
    scheduled_workflow_service: ScheduleTriggerService,
):
    """Create an overdue schedule (already due for execution)."""
    schedule = await scheduled_workflow_service.create_schedule(
        workflow_id=workflow_with_trigger.id,
        interval_seconds=10,
        start_at=datetime.now() - timedelta(seconds=20),  # Started 20 seconds ago
    )
    return schedule


@pytest.fixture(scope="function")
async def future_workflow_schedule(
    workflow_with_trigger: Workflow,
    scheduled_workflow_service: ScheduleTriggerService,
):
    """Create a schedule scheduled for the future."""
    schedule = await scheduled_workflow_service.create_schedule(
        workflow_id=workflow_with_trigger.id,
        interval_seconds=60,
        start_at=datetime.now() + timedelta(seconds=300),  # 5 minutes in future
    )
    return schedule
