"""
Test authentication endpoints.
"""
import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from argon2 import PasswordHasher

from src.db.models import User


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, test_db: AsyncSession):
    """
    Test POST /auth/login with valid credentials.
    
    This test demonstrates:
    - Creating test data in the database
    - Making an API request
    - Validating the response structure and status code
    """
    # Arrange: Create a test user in the database
    ph = PasswordHasher()
    test_user = User(
        email="test@example.com",
        hashed_password=ph.hash("testpassword123"),
        name="Test User"
    )
    test_db.add(test_user)
    await test_db.commit()
    await test_db.refresh(test_user)
    
    # Act: Attempt to login with valid credentials
    response = await client.post(
        "/auth/login",
        json={
            "email": "test@example.com",
            "password": "testpassword123"
        }
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
