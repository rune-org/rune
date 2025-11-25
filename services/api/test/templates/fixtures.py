"""Template test fixtures."""

import pytest_asyncio

from src.db.models import User, UserRole, WorkflowTemplate
from src.templates.service import TemplateService
from argon2 import PasswordHasher


@pytest_asyncio.fixture(scope="function")
async def template_service(test_db):
    """Create a TemplateService instance with test database."""
    return TemplateService(db=test_db)


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
async def sample_public_template(test_db, test_user):
    """Create a sample public template for testing."""
    template = WorkflowTemplate(
        name="Public Automation Template",
        description="A public template for testing",
        category="automation",
        workflow_data={
            "nodes": [
                {"id": "node-1", "type": "trigger", "data": {"label": "Start"}},
                {"id": "node-2", "type": "action", "data": {"label": "Process"}},
            ],
            "edges": [{"id": "edge-1", "source": "node-1", "target": "node-2"}],
        },
        is_public=True,
        usage_count=5,
        created_by=test_user.id,
    )
    test_db.add(template)
    await test_db.commit()
    await test_db.refresh(template)
    return template


@pytest_asyncio.fixture(scope="function")
async def sample_private_template(test_db, test_user):
    """Create a sample private template for testing."""
    template = WorkflowTemplate(
        name="Private Automation Template",
        description="A private template for testing",
        category="data-processing",
        workflow_data={
            "nodes": [{"id": "node-1", "type": "trigger", "data": {"label": "Start"}}],
            "edges": [],
        },
        is_public=False,
        usage_count=2,
        created_by=test_user.id,
    )
    test_db.add(template)
    await test_db.commit()
    await test_db.refresh(template)
    return template


@pytest_asyncio.fixture(scope="function")
async def other_user_private_template(test_db, other_user):
    """Create a private template owned by other_user."""
    template = WorkflowTemplate(
        name="Other User's Private Template",
        description="A private template from another user",
        category="testing",
        workflow_data={},
        is_public=False,
        usage_count=0,
        created_by=other_user.id,
    )
    test_db.add(template)
    await test_db.commit()
    await test_db.refresh(template)
    return template


@pytest_asyncio.fixture(scope="function")
def sample_template_data():
    """Provide complex nested workflow data for template testing."""
    return {
        "nodes": [
            {
                "id": "node-1",
                "type": "trigger",
                "position": {"x": 100, "y": 100},
                "data": {
                    "label": "HTTP Webhook",
                    "config": {
                        "trigger_type": "webhook",
                        "parameters": {"method": "POST", "path": "/webhook"},
                    },
                },
            },
            {
                "id": "node-2",
                "type": "action",
                "position": {"x": 300, "y": 100},
                "data": {
                    "label": "Parse JSON",
                    "config": {
                        "action_type": "transform",
                        "parameters": {"format": "json"},
                    },
                },
            },
            {
                "id": "node-3",
                "type": "action",
                "position": {"x": 500, "y": 100},
                "data": {
                    "label": "Send Email",
                    "config": {
                        "action_type": "email",
                        "parameters": {
                            "to": "user@example.com",
                            "subject": "Alert",
                            "body": "Workflow triggered",
                        },
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
            "author": "template_creator",
            "tags": ["webhook", "email", "automation"],
        },
    }
