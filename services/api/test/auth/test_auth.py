"""
Test authentication endpoints.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, test_user):
    """
    Test POST /auth/login with valid credentials.

    This test demonstrates:
    - Using test fixtures for data setup
    - Making an API request
    - Validating the response structure and status code
    """
    # Act: Attempt to login with valid credentials (test_user fixture creates the user)
    response = await client.post(
        "/auth/login", json={"email": "test@example.com", "password": "testpassword123"}
    )

    # Assert: Verify successful login
    assert response.status_code == 200

    data = response.json()
    assert data["success"] is True
    assert data["message"] == "Authenticated"
    assert "data" in data
    assert "access_token" in data["data"]
    assert "refresh_token" in data["data"]

    # Verify cookie was set
    assert "access_token" in response.cookies
