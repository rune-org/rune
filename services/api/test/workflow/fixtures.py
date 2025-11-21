"""Workflow test fixtures."""

import pytest
import pytest_asyncio
from argon2 import PasswordHasher

from src.db.models import User, UserRole, Workflow, WorkflowUser, WorkflowRole
from src.workflow.service import WorkflowService


@pytest_asyncio.fixture(scope="function")
async def other_user(test_db):
    """Create a second test user in the database."""
    ph = PasswordHasher()
    user = User(
        email="other@example.com",
        hashed_password=ph.hash("otherpassword123"),
        name="Other User",
        role=UserRole.USER,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def workflow_service(test_db):
    """Create a WorkflowService instance with test database."""
    return WorkflowService(db=test_db)


@pytest_asyncio.fixture(scope="function")
async def sample_workflow(test_db, test_user):
    """Create a sample workflow for testing."""
    workflow = Workflow(
        name="Sample Workflow",
        description="A sample workflow for testing",
        workflow_data={
            "nodes": [{"id": "node-1", "type": "trigger", "data": {"label": "Start"}}],
            "edges": [],
        },
        is_active=False,
        version=1,
    )
    test_db.add(workflow)
    await test_db.flush()

    # Add user permission for test_user (no roles in MVP)
    permission = WorkflowUser(
        workflow_id=workflow.id,
        user_id=test_user.id,
        granted_by=test_user.id,
        role=WorkflowRole.OWNER,
    )
    test_db.add(permission)
    await test_db.commit()
    await test_db.refresh(workflow)

    return workflow


@pytest.fixture(scope="function")
def sample_workflow_data():
    """Provide complex nested workflow data for testing."""
    return {
        "nodes": [
            {
                "id": "node-1",
                "type": "trigger",
                "position": {"x": 100, "y": 100},
                "data": {
                    "label": "Start",
                    "config": {
                        "trigger_type": "manual",
                        "parameters": {"timeout": 30},
                    },
                },
            },
            {
                "id": "node-2",
                "type": "action",
                "position": {"x": 300, "y": 100},
                "data": {
                    "label": "HTTP Request",
                    "config": {
                        "url": "https://api.example.com",
                        "method": "POST",
                        "headers": {"Content-Type": "application/json"},
                        "body": {"key": "value"},
                    },
                },
            },
            {
                "id": "node-3",
                "type": "condition",
                "position": {"x": 500, "y": 100},
                "data": {
                    "label": "Check Response",
                    "config": {
                        "condition": "response.status == 200",
                        "branches": ["success", "failure"],
                    },
                },
            },
        ],
        "edges": [
            {
                "id": "edge-1",
                "source": "node-1",
                "target": "node-2",
                "type": "default",
            },
            {
                "id": "edge-2",
                "source": "node-2",
                "target": "node-3",
                "type": "default",
            },
        ],
        "metadata": {
            "version": "1.0",
            "author": "test_user",
            "tags": ["http", "api", "test"],
        },
    }
