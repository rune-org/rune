"""Workflow test-specific fixtures."""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from src.app import app
from src.core.password import hash_password
from src.db.models import User, UserRole, WorkflowRole, WorkflowUser


@pytest_asyncio.fixture(scope="function")
async def viewer_user(test_db):
    """Create a user who will be given VIEWER role on workflows.

    Uses the app's hash_password() function to ensure password compatibility with login.
    """
    user = User(
        email="viewer@example.com",
        hashed_password=hash_password("viewerpassword123"),
        name="Viewer User",
        role=UserRole.USER,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


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
    """Create a separate authenticated HTTP client for viewer user."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        response = await c.post(
            "/auth/login",
            json={"email": "viewer@example.com", "password": "viewerpassword123"},
        )
        assert response.status_code == 200, (
            f"Viewer login failed: {response.status_code} {response.text}"
        )
        yield c


@pytest_asyncio.fixture(scope="function")
async def other_user(test_db):
    """Create a second test user with no workflow access."""
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
async def other_client(client, other_user):
    """Create a separate authenticated HTTP client for other user (no workflow access)."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        response = await c.post(
            "/auth/login",
            json={"email": "other@example.com", "password": "otherpassword123"},
        )
        assert response.status_code == 200, (
            f"Other user login failed: {response.status_code} {response.text}"
        )
        yield c
