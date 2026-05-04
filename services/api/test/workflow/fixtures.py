"""Workflow test fixtures."""

import pytest
import pytest_asyncio

from src.core.password import hash_password
from src.db.models import User, UserRole
from src.workflow.service import WorkflowService


@pytest_asyncio.fixture(scope="function")
async def other_user(test_db):
    """Create a second test user in the database.

    Uses the app's hash_password() function to ensure password compatibility with login.
    """
    user = User(
        email="other@example.com",
        hashed_password=hash_password("otherpassword123"),
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
async def sample_workflow(workflow_service, test_db, test_user):
    """Create a sample workflow with one saved version."""
    workflow = await workflow_service.create(
        user_id=test_user.id,
        name="Sample Workflow",
        description="A sample workflow for testing",
    )
    await workflow_service.create_version(
        workflow=workflow,
        user_id=test_user.id,
        workflow_data={
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
        },
        base_version_id=None,
        message="Initial version",
    )
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
                "trigger": True,
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
                "src": "node-1",
                "dst": "node-2",
                "type": "default",
            },
            {
                "id": "edge-2",
                "src": "node-2",
                "dst": "node-3",
                "type": "default",
            },
        ],
        "metadata": {
            "version": "1.0",
            "author": "test_user",
            "tags": ["http", "api", "test"],
        },
    }
