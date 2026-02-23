from datetime import datetime, timedelta, timezone

import jwt
import pytest
from httpx import AsyncClient

from src.core.config import get_settings

# ============================================================================
# BEARER TOKEN AUTHENTICATION TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_bearer_token_auth_success(client: AsyncClient, test_user):
    """Test that Bearer token authentication works for protected endpoints."""
    # First, login to get access token
    login_response = await client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "testpassword123"},
    )
    assert login_response.status_code == 200
    access_token = login_response.json()["data"]["access_token"]

    # Clear cookies to ensure we're testing Bearer token only
    client.cookies.clear()

    # Make request with Bearer token
    response = await client.get(
        "/profile/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_bearer_token_auth_invalid(client: AsyncClient, test_user):
    """Test that invalid Bearer token returns 401."""
    response = await client.get(
        "/profile/me",
        headers={"Authorization": "Bearer invalid_token_here"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_bearer_token_auth_expired(client: AsyncClient, test_user):
    """Test that expired Bearer token returns 401."""
    settings = get_settings()

    # Create an expired token
    past_time = datetime.now(timezone.utc) - timedelta(hours=2)
    expired_payload = {
        "sub": str(test_user.id),
        "email": test_user.email,
        "name": test_user.name,
        "role": test_user.role,
        "must_change_password": test_user.must_change_password,
        "iat": past_time,
        "exp": past_time + timedelta(minutes=30),  # Expired 1.5 hours ago
        "created_at": test_user.created_at.isoformat(),
        "updated_at": test_user.updated_at.isoformat(),
    }
    expired_token = jwt.encode(
        expired_payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    response = await client.get(
        "/profile/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_cookie_takes_precedence_over_bearer(client: AsyncClient, test_user):
    """Test that cookie authentication takes precedence over Bearer token."""
    # Login to get access token and set cookie
    login_response = await client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "testpassword123"},
    )
    assert login_response.status_code == 200

    # Make request with both cookie (already set from login) and invalid Bearer token
    # Cookie should take precedence, so request should succeed
    response = await client.get(
        "/profile/me",
        headers={"Authorization": "Bearer invalid_token"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_no_auth_returns_401(client: AsyncClient, test_user):
    """Test that missing authentication returns 401."""
    # Clear any existing cookies
    client.cookies.clear()

    response = await client.get("/profile/me")
    assert response.status_code == 401
    data = response.json()
    assert data["message"] == "Not authenticated"


@pytest.mark.asyncio
async def test_bearer_token_without_bearer_prefix(client: AsyncClient, test_user):
    """Test that Authorization header without 'Bearer ' prefix fails."""
    # Login to get access token
    login_response = await client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "testpassword123"},
    )
    assert login_response.status_code == 200
    access_token = login_response.json()["data"]["access_token"]

    # Clear cookies
    client.cookies.clear()

    # Make request without 'Bearer ' prefix - should fail
    response = await client.get(
        "/profile/me",
        headers={"Authorization": access_token},
    )
    assert response.status_code == 401
