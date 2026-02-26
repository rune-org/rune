import pytest_asyncio
from argon2 import PasswordHasher

from src.db.models import User, UserRole, Workflow, WorkflowRole, WorkflowUser


@pytest_asyncio.fixture(scope="function")
async def other_user(test_db):
    """Create a second test user without any workflow access."""
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
async def viewer_user(test_db):
    """Create a user who will be given VIEWER role on workflows."""
    ph = PasswordHasher()
    user = User(
        email="viewer@example.com",
        hashed_password=ph.hash("viewerpassword123"),
        name="Viewer User",
        role=UserRole.USER,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def sample_workflow(test_db, test_user):
    """Create a sample workflow owned by test_user."""
    workflow = Workflow(
        name="Sample Workflow",
        description="A sample workflow for testing",
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
        is_active=False,
        version=1,
    )
    test_db.add(workflow)
    await test_db.flush()

    # Add OWNER permission for test_user
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


@pytest_asyncio.fixture(scope="function")
async def workflow_with_viewer(test_db, sample_workflow, viewer_user, test_user):
    """Grant VIEWER access to viewer_user on sample_workflow."""
    permission = WorkflowUser(
        workflow_id=sample_workflow.id,
        user_id=viewer_user.id,
        granted_by=test_user.id,
        role=WorkflowRole.VIEWER,
    )
    test_db.add(permission)
    await test_db.commit()

    return sample_workflow


@pytest_asyncio.fixture(scope="function")
async def viewer_client(client, viewer_user):
    """Create an authenticated HTTP client for viewer user."""
    response = await client.post(
        "/auth/login",
        json={"email": "viewer@example.com", "password": "viewerpassword123"},
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return client


@pytest_asyncio.fixture(scope="function")
async def other_client(client, other_user):
    """Create an authenticated HTTP client for other user (no workflow access)."""
    response = await client.post(
        "/auth/login",
        json={"email": "other@example.com", "password": "otherpassword123"},
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return client
