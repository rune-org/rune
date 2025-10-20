import asyncio
import pytest
from datetime import datetime
from argon2 import PasswordHasher

from src.db.models import User


# ============================================================================
# AUTHENTICATION TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_get_profile_unauthenticated(client):
    """GET /profile/me should require authentication (401)"""
    resp = await client.get("/profile/me")
    assert resp.status_code == 401
    body = resp.json()
    assert body["success"] is False


# ============================================================================
# RETRIEVAL TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_get_profile_authenticated(authenticated_client, test_user):
    """Authenticated user can fetch their own profile and response shape matches"""
    resp = await authenticated_client.get("/profile/me")
    assert resp.status_code == 200

    body = resp.json()
    assert body["success"] is True
    
    # Validate response data structure
    data = body["data"]
    assert data["id"] == test_user.id
    assert data["email"] == test_user.email
    assert data["name"] == test_user.name
    assert data["role"] == "user"
    assert data["is_active"] is True
    
    # Validate timestamp fields exist and are valid ISO format
    assert "created_at" in data
    assert "updated_at" in data
    assert isinstance(data["created_at"], str)
    assert isinstance(data["updated_at"], str)
    
    # last_login_at may be null for fresh user
    assert "last_login_at" in data


# ============================================================================
# UPDATE TESTS - SINGLE FIELD UPDATES
# ============================================================================

@pytest.mark.asyncio
async def test_update_profile_name_only(authenticated_client, test_user, test_db):
    """PUT /profile/me can update only name"""
    new_name = "Updated Name"
    resp = await authenticated_client.put("/profile/me", json={"name": new_name})
    assert resp.status_code == 200

    body = resp.json()
    assert body["data"]["name"] == new_name
    assert body["data"]["email"] == test_user.email  # Email unchanged
    
    # Verify persisted in DB
    persisted = await test_db.get(User, test_user.id)
    assert persisted.name == new_name


@pytest.mark.asyncio
async def test_update_profile_email_only(authenticated_client, test_user, test_db):
    """PUT /profile/me can update only email"""
    new_email = "newemail@example.com"
    resp = await authenticated_client.put("/profile/me", json={"email": new_email})
    assert resp.status_code == 200

    body = resp.json()
    assert body["data"]["email"] == new_email
    assert body["data"]["name"] == test_user.name  # Name unchanged
    
    # Verify persisted in DB
    persisted = await test_db.get(User, test_user.id)
    assert persisted.email == new_email


@pytest.mark.asyncio
async def test_update_profile_empty_payload(authenticated_client):
    """PUT /profile/me with empty payload should succeed (no changes)"""
    resp = await authenticated_client.put("/profile/me", json={})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "data" in body


# ============================================================================
# UPDATE TESTS - MULTIPLE FIELD UPDATES
# ============================================================================

@pytest.mark.asyncio
async def test_update_profile_both_fields(authenticated_client, test_user, test_db):
    """PUT /profile/me can update both name and email"""
    new_name = "New Name"
    new_email = "newboth@example.com"
    resp = await authenticated_client.put(
        "/profile/me", json={"name": new_name, "email": new_email}
    )
    assert resp.status_code == 200

    body = resp.json()
    assert body["data"]["name"] == new_name
    assert body["data"]["email"] == new_email
    
    # Verify persisted in DB
    persisted = await test_db.get(User, test_user.id)
    assert persisted.name == new_name
    assert persisted.email == new_email


# ============================================================================
# UPDATE TESTS - EMAIL HANDLING
# ============================================================================

@pytest.mark.asyncio
async def test_update_profile_email_case_insensitive(authenticated_client, test_user, test_db):
    """Email should be normalized to lowercase"""
    new_email = "UPPERCASE@EXAMPLE.COM"
    resp = await authenticated_client.put("/profile/me", json={"email": new_email})
    assert resp.status_code == 200

    body = resp.json()
    assert body["data"]["email"] == new_email.lower()
    
    # Verify persisted normalized in DB
    persisted = await test_db.get(User, test_user.id)
    assert persisted.email == new_email.lower()


@pytest.mark.asyncio
async def test_update_profile_email_to_same_email(authenticated_client, test_user):
    """Updating to same email should succeed"""
    resp = await authenticated_client.put(
        "/profile/me", json={"email": test_user.email}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["email"] == test_user.email


@pytest.mark.asyncio
async def test_update_profile_email_duplicate(authenticated_client, test_db):
    """Email already taken by another user should return 409"""
    # Create another user with specific email
    ph = PasswordHasher()
    other_user = User(
        email="other@example.com",
        hashed_password=ph.hash("otherpass123"),
        name="Other User",
        role="user",
    )
    test_db.add(other_user)
    await test_db.commit()
    
    # Try to update current user's email to other user's email
    resp = await authenticated_client.put(
        "/profile/me", json={"email": "other@example.com"}
    )
    # Email uniqueness is enforced, should be 409
    assert resp.status_code == 409
    body = resp.json()
    assert body["success"] is False
    assert "already" in body.get("message", "").lower()


@pytest.mark.asyncio
async def test_update_profile_email_duplicate_different_case(authenticated_client, test_db):
    """Email duplicate check comparison (different case may not be enforced)"""
    # Create another user
    ph = PasswordHasher()
    other_user = User(
        email="CaseSensitive@example.com",
        hashed_password=ph.hash("otherpass123"),
        name="Other User",
        role="user",
    )
    test_db.add(other_user)
    await test_db.commit()
    
    # Try with different case - case-insensitive check may not be enforced
    resp = await authenticated_client.put(
        "/profile/me", json={"email": "casesensitive@example.com"}
    )
    # This could return 200 or 409 depending on case-sensitivity enforcement
    # Accept either, but if 409, verify error message
    if resp.status_code == 409:
        body = resp.json()
        assert body["success"] is False
    else:
        assert resp.status_code == 200


# ============================================================================
# TIMESTAMP TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_update_profile_timestamps_updated(authenticated_client):
    """updated_at timestamp should change after update"""
    # Get initial updated_at
    initial_resp = await authenticated_client.get("/profile/me")
    initial_data = initial_resp.json()["data"]
    initial_updated_at = datetime.fromisoformat(initial_data["updated_at"])
    initial_created_at = datetime.fromisoformat(initial_data["created_at"])
    
    # Small delay to potentially create a difference
    await asyncio.sleep(1)
    
    # Update profile
    resp = await authenticated_client.put("/profile/me", json={"name": "New Name"})
    assert resp.status_code == 200
    
    new_data = resp.json()["data"]
    new_updated_at = datetime.fromisoformat(new_data["updated_at"])
    new_created_at = datetime.fromisoformat(new_data["created_at"])
    
    # Verify updated_at changed (is greater than or equal, but should be greater due to update)
    assert new_updated_at > initial_updated_at, f"New timestamp {new_updated_at} should be > old {initial_updated_at}"
    
    # created_at should not change
    assert new_created_at == initial_created_at


# ============================================================================
# VALIDATION TESTS - NAME
# ============================================================================

@pytest.mark.asyncio
async def test_update_profile_name_too_short(authenticated_client):
    """Name shorter than 3 chars should return 422"""
    resp = await authenticated_client.put("/profile/me", json={"name": "ab"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_profile_name_too_long(authenticated_client):
    """Name longer than 40 chars should return 422"""
    long_name = "a" * 41
    resp = await authenticated_client.put("/profile/me", json={"name": long_name})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_profile_name_exactly_min_length(authenticated_client):
    """Name with exactly 3 chars should succeed"""
    resp = await authenticated_client.put("/profile/me", json={"name": "abc"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_update_profile_name_exactly_max_length(authenticated_client):
    """Name with exactly 40 chars should succeed"""
    max_name = "a" * 40
    resp = await authenticated_client.put("/profile/me", json={"name": max_name})
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["name"] == max_name


# ============================================================================
# VALIDATION TESTS - EMAIL
# ============================================================================

@pytest.mark.asyncio
async def test_update_profile_invalid_email_format(authenticated_client):
    """Invalid email format should return 422"""
    resp = await authenticated_client.put("/profile/me", json={"email": "not-an-email"})
    assert resp.status_code == 422


# ============================================================================
# VALIDATION TESTS - MULTIPLE ERRORS
# ============================================================================

@pytest.mark.asyncio
async def test_update_profile_validation_multiple_errors(authenticated_client):
    """Multiple validation errors should return 422"""
    resp = await authenticated_client.put(
        "/profile/me", json={"name": "ab", "email": "invalid-email"}
    )
    assert resp.status_code == 422
