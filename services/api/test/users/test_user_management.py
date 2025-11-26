import pytest
from argon2 import PasswordHasher
from src.db.models import User
from sqlmodel import select


# ============================================================================
# AUTHENTICATION & AUTHORIZATION TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_users_list_requires_authentication(client):
    """GET /users/ requires authentication (401)"""
    resp = await client.get("/users/")
    assert resp.status_code == 401
    body = resp.json()
    assert body["success"] is False


@pytest.mark.asyncio
async def test_users_list_forbidden_for_non_admin(authenticated_client):
    """Regular authenticated user cannot list users (403 Forbidden, not 401)"""
    resp = await authenticated_client.get("/users/")
    # Should be 403 Forbidden (user is authenticated but not admin)
    assert resp.status_code == 403
    body = resp.json()
    assert body["success"] is False
    assert (
        "permission" in body.get("message", "").lower()
        or "admin" in body.get("message", "").lower()
    )


@pytest.mark.asyncio
async def test_get_user_by_id_forbidden_for_non_admin(authenticated_client, test_user):
    """Regular user cannot view other users (403)"""
    resp = await authenticated_client.get(f"/users/{test_user.id}")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_user_forbidden_for_non_admin(authenticated_client):
    """Regular user cannot create users (403)"""
    payload = {
        "name": "New User",
        "email": "newuser@example.com",
    }
    resp = await authenticated_client.post("/users/", json=payload)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_update_user_forbidden_for_non_admin(authenticated_client, test_user):
    """Regular user cannot update other users (403)"""
    resp = await authenticated_client.put(
        f"/users/{test_user.id}", json={"name": "Renamed"}
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_user_forbidden_for_non_admin(authenticated_client, test_user):
    """Regular user cannot delete users (403)"""
    resp = await authenticated_client.delete(f"/users/{test_user.id}")
    assert resp.status_code == 403


# ============================================================================
# ADMIN LIST USERS TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_users_list_admin_empty(admin_client, test_db):
    """GET /users/ returns empty list when no users exist (except admin)"""
    # Delete all users except admin
    statement = select(User).where(User.role == "user")
    result = await test_db.exec(statement)
    users = result.all()
    for user in users:
        await test_db.delete(user)
    await test_db.commit()

    resp = await admin_client.get("/users/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)


@pytest.mark.asyncio
async def test_users_list_admin_multiple(admin_client, test_db, test_user):
    """GET /users/ returns all users"""
    resp = await admin_client.get("/users/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)
    assert len(body["data"]) > 0

    # Verify user structure
    user_data = body["data"][0]
    assert "id" in user_data
    assert "name" in user_data
    assert "email" in user_data
    assert "role" in user_data
    assert "is_active" in user_data
    assert "created_at" in user_data


@pytest.mark.asyncio
async def test_users_list_response_structure(admin_client):
    """Verify response structure matches ApiResponse format"""
    resp = await admin_client.get("/users/")
    assert resp.status_code == 200
    body = resp.json()

    # Verify ApiResponse structure
    assert "success" in body
    assert "message" in body
    assert "data" in body
    assert body["success"] is True


# ============================================================================
# GET USER BY ID TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_get_user_by_id_admin(admin_client, test_user):
    """Admin can retrieve user by ID (200)"""
    resp = await admin_client.get(f"/users/{test_user.id}")
    assert resp.status_code == 200
    body = resp.json()

    data = body["data"]
    assert data["id"] == test_user.id
    assert data["email"] == test_user.email
    assert data["name"] == test_user.name
    assert data["role"] == "user"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_get_user_by_id_admin_full_response(admin_client, test_user):
    """Verify complete response structure for GET user"""
    resp = await admin_client.get(f"/users/{test_user.id}")
    assert resp.status_code == 200
    body = resp.json()

    assert body["success"] is True
    assert "message" in body

    data = body["data"]
    assert "created_at" in data
    assert "updated_at" in data
    assert "last_login_at" in data
    assert isinstance(data["created_at"], str)
    assert isinstance(data["updated_at"], str)


@pytest.mark.asyncio
async def test_get_user_by_id_not_found(admin_client):
    """GET /users/99999 returns 404 when user doesn't exist"""
    resp = await admin_client.get("/users/99999")
    assert resp.status_code == 404
    body = resp.json()
    assert body["success"] is False
    assert "not found" in body.get("message", "").lower()


@pytest.mark.asyncio
async def test_get_user_by_id_invalid_id_format(admin_client):
    """GET /users/{invalid_id} with non-integer ID"""
    # FastAPI should validate and return 422 for non-integer path params
    resp = await admin_client.get("/users/not-a-number")
    assert resp.status_code == 422


# ============================================================================
# CREATE USER TESTS - BASIC OPERATIONS
# ============================================================================


@pytest.mark.asyncio
async def test_create_user_success(admin_client, test_db):
    """Admin can create user successfully (201)"""
    payload = {
        "name": "New User",
        "email": "newuser@example.com",
    }
    resp = await admin_client.post("/users/", json=payload)
    assert resp.status_code == 201

    body = resp.json()
    assert body["success"] is True
    assert body["data"]["user"]["email"] == "newuser@example.com"
    assert body["data"]["user"]["name"] == "New User"
    assert body["data"]["user"]["role"] == "user"
    assert body["data"]["user"]["is_active"] is True
    assert "temporary_password" in body["data"]

    # verify persisted
    created_id = body["data"]["user"]["id"]
    persisted = await test_db.get(User, created_id)
    assert persisted is not None
    assert persisted.email == "newuser@example.com"


@pytest.mark.asyncio
async def test_create_user_with_admin_role(admin_client, test_db):
    """Admin can create user with admin role"""
    payload = {
        "name": "New Admin",
        "email": "newadmin@example.com",
        "role": "admin",
    }
    resp = await admin_client.post("/users/", json=payload)
    assert resp.status_code == 201
    body = resp.json()
    assert body["data"]["user"]["role"] == "admin"

    # Verify in DB
    created_id = body["data"]["user"]["id"]
    persisted = await test_db.get(User, created_id)
    assert persisted.role == "admin"


@pytest.mark.asyncio
async def test_create_user_response_no_password(admin_client):
    """Created user response should not include password"""
    payload = {
        "name": "New User",
        "email": "newuser@example.com",
    }
    resp = await admin_client.post("/users/", json=payload)
    assert resp.status_code == 201
    body = resp.json()

    # Password should NOT be in response (but temporary_password is provided)
    assert "password" not in body["data"]["user"]
    assert "hashed_password" not in body["data"]["user"]
    assert "temporary_password" in body["data"]


@pytest.mark.asyncio
async def test_create_user_email_normalized(admin_client, test_db):
    """Email should be normalized to lowercase when creating user"""
    payload = {
        "name": "New User",
        "email": "NewUser@EXAMPLE.COM",
    }
    resp = await admin_client.post("/users/", json=payload)
    assert resp.status_code == 201
    body = resp.json()
    assert body["data"]["user"]["email"] == "newuser@example.com"

    # Verify in DB
    created_id = body["data"]["user"]["id"]
    persisted = await test_db.get(User, created_id)
    assert persisted.email == "newuser@example.com"


# ============================================================================
# CREATE USER TESTS - VALIDATION & ERROR HANDLING
# ============================================================================


@pytest.mark.asyncio
async def test_create_user_missing_required_fields(admin_client):
    """Create with missing required fields returns 422"""
    resp = await admin_client.post("/users/", json={"email": "test@example.com"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_user_invalid_email(admin_client):
    """Invalid email format returns 422"""
    payload = {"name": "New User", "email": "not-an-email"}
    resp = await admin_client.post("/users/", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_user_name_too_short(admin_client):
    """Name shorter than 3 chars returns 422"""
    payload = {
        "name": "ab",
        "email": "newuser@example.com",
    }
    resp = await admin_client.post("/users/", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_user_name_too_long(admin_client):
    """Name longer than 40 chars returns 422"""
    payload = {
        "name": "a" * 41,
        "email": "newuser@example.com",
    }
    resp = await admin_client.post("/users/", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_user_name_exactly_min_length(admin_client, test_db):
    """Name with exactly 3 chars should succeed"""
    payload = {
        "name": "abc",
        "email": "newuser@example.com",
    }
    resp = await admin_client.post("/users/", json=payload)
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_create_user_name_exactly_max_length(admin_client, test_db):
    """Name with exactly 40 chars should succeed"""
    payload = {
        "name": "a" * 40,
        "email": "newuser@example.com",
    }
    resp = await admin_client.post("/users/", json=payload)
    assert resp.status_code == 201
    body = resp.json()
    assert body["data"]["user"]["name"] == "a" * 40


@pytest.mark.asyncio
async def test_create_user_duplicate_email(admin_client, test_user):
    """Creating user with existing email returns 409 Conflict"""
    payload = {
        "name": "Another User",
        "email": test_user.email,
    }
    resp = await admin_client.post("/users/", json=payload)
    # Email uniqueness is enforced, should be 409
    assert resp.status_code == 409
    body = resp.json()
    assert body["success"] is False
    assert "already" in body.get("message", "").lower()


@pytest.mark.asyncio
async def test_create_user_duplicate_email_case_insensitive(admin_client, test_user):
    """Duplicate email check is case-insensitive"""
    payload = {
        "name": "Another User",
        "email": test_user.email.upper(),
    }
    resp = await admin_client.post("/users/", json=payload)
    # Case-insensitive email uniqueness is enforced, should be 409
    assert resp.status_code == 409
    body = resp.json()
    assert body["success"] is False


# ============================================================================
# UPDATE USER TESTS - BASIC OPERATIONS
# ============================================================================


@pytest.mark.asyncio
async def test_admin_update_user_name(admin_client, test_user, test_db):
    """Admin can update user name"""
    resp = await admin_client.put(f"/users/{test_user.id}", json={"name": "Renamed"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["name"] == "Renamed"
    assert body["data"]["email"] == test_user.email

    # Verify in DB
    persisted = await test_db.get(User, test_user.id)
    assert persisted.name == "Renamed"


@pytest.mark.asyncio
async def test_admin_update_user_email(admin_client, test_user, test_db):
    """Admin can update user email"""
    resp = await admin_client.put(
        f"/users/{test_user.id}", json={"email": "newemail@example.com"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["email"] == "newemail@example.com"

    # Verify in DB
    persisted = await test_db.get(User, test_user.id)
    assert persisted.email == "newemail@example.com"


@pytest.mark.asyncio
async def test_admin_update_user_role(admin_client, test_user, test_db):
    """Admin can change user role"""
    resp = await admin_client.put(f"/users/{test_user.id}", json={"role": "admin"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["role"] == "admin"

    # Verify in DB
    persisted = await test_db.get(User, test_user.id)
    assert persisted.role == "admin"


@pytest.mark.asyncio
async def test_admin_update_user_is_active(admin_client, test_user, test_db):
    """Admin can deactivate user"""
    resp = await admin_client.put(f"/users/{test_user.id}", json={"is_active": False})
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["is_active"] is False

    # Verify in DB
    persisted = await test_db.get(User, test_user.id)
    assert persisted.is_active is False


@pytest.mark.asyncio
async def test_admin_update_user_multiple_fields(admin_client, test_user, test_db):
    """Admin can update multiple fields at once"""
    resp = await admin_client.put(
        f"/users/{test_user.id}",
        json={
            "name": "New Name",
            "email": "new@example.com",
            "role": "admin",
            "is_active": False,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["name"] == "New Name"
    assert body["data"]["email"] == "new@example.com"
    assert body["data"]["role"] == "admin"
    assert body["data"]["is_active"] is False


@pytest.mark.asyncio
async def test_admin_update_user_empty_payload(admin_client, test_user):
    """Update with empty payload should succeed (no changes)"""
    resp = await admin_client.put(f"/users/{test_user.id}", json={})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True


# ============================================================================
# UPDATE USER TESTS - VALIDATION & ERROR HANDLING
# ============================================================================


@pytest.mark.asyncio
async def test_admin_update_user_not_found(admin_client):
    """Updating non-existent user returns 404"""
    resp = await admin_client.put("/users/99999", json={"name": "New Name"})
    assert resp.status_code == 404
    body = resp.json()
    assert body["success"] is False
    assert "not found" in body.get("message", "").lower()


@pytest.mark.asyncio
async def test_admin_update_user_email_duplicate(admin_client, test_db):
    """Cannot update user to email already taken by another (409)"""
    ph = PasswordHasher()

    # Create two users
    user1 = User(
        email="user1@example.com",
        hashed_password=ph.hash("pass123"),
        name="User 1",
        role="user",
    )
    user2 = User(
        email="user2@example.com",
        hashed_password=ph.hash("pass123"),
        name="User 2",
        role="user",
    )
    test_db.add(user1)
    test_db.add(user2)
    await test_db.commit()

    # Try to update user1's email to user2's email
    resp = await admin_client.put(
        f"/users/{user1.id}", json={"email": "user2@example.com"}
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_admin_update_user_validation_name_too_short(admin_client, test_user):
    """Update with invalid name returns 422"""
    resp = await admin_client.put(f"/users/{test_user.id}", json={"name": "ab"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_admin_update_user_validation_invalid_email(admin_client, test_user):
    """Update with invalid email returns 422"""
    resp = await admin_client.put(
        f"/users/{test_user.id}", json={"email": "invalid-email"}
    )
    assert resp.status_code == 422


# ============================================================================
# DELETE USER TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_admin_delete_user_success(admin_client, test_db):
    """Admin can delete user (204)"""
    # Create a user to delete
    ph = PasswordHasher()
    user = User(
        email="todelete@example.com",
        hashed_password=ph.hash("deletepass123"),
        name="ToDelete",
        role="user",
    )
    test_db.add(user)
    await test_db.commit()
    user_id = user.id

    # Delete the user
    resp = await admin_client.delete(f"/users/{user_id}")
    assert resp.status_code == 204

    # Verify response has no body
    assert resp.content == b"" or resp.text == ""

    # Verify user is deleted from DB
    deleted = await test_db.get(User, user_id)
    assert deleted is None


@pytest.mark.asyncio
async def test_admin_delete_user_not_found(admin_client):
    """Deleting non-existent user returns 404"""
    resp = await admin_client.delete("/users/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_user_requires_admin(authenticated_client, test_user):
    """Non-admin cannot delete user (403)"""
    # Try to delete another user
    resp = await authenticated_client.delete(f"/users/{test_user.id}")
    assert resp.status_code == 403


# ============================================================================
# EDGE CASES
# ============================================================================


@pytest.mark.asyncio
async def test_admin_update_user_email_to_existing_case_insensitive(
    admin_client, test_db
):
    """Updating a user's email to another user's email with different case should return 409"""
    ph = PasswordHasher()

    # Create two users with similar emails differing only by case
    user_lower = User(
        email="x@gmail.com",
        hashed_password=ph.hash("pass12345"),
        name="Lower",
        role="user",
    )
    user_upper = User(
        email="m@gmail.com",
        hashed_password=ph.hash("pass12345"),
        name="Upper",
        role="user",
    )
    test_db.add(user_lower)
    test_db.add(user_upper)
    await test_db.commit()

    # Attempt to change user_lower's email to user_upper's email but with different casing
    resp = await admin_client.put(
        f"/users/{user_lower.id}", json={"email": "M@gmail.com"}
    )
    # Should be treated as duplicate (case-insensitive) -> 409
    assert resp.status_code == 409
    body = resp.json()
    assert body["success"] is False
    assert (
        "already" in body.get("message", "").lower()
        or "exists" in body.get("message", "").lower()
    )


@pytest.mark.asyncio
async def test_admin_update_user_email_when_user_deleted_race(admin_client, test_db):
    """Simulate update where target user gets deleted between read and write resulting in 404 or 409 depending on implementation."""
    ph = PasswordHasher()

    # Create a user to be updated
    victim = User(
        email="victim@example.com",
        hashed_password=ph.hash("pass12345"),
        name="Victim",
        role="user",
    )
    test_db.add(victim)
    await test_db.commit()

    # Delete the user directly via DB to simulate concurrent deletion
    await test_db.delete(victim)
    await test_db.commit()

    # Now admin tries to update the deleted user
    resp = await admin_client.put(
        f"/users/{victim.id}", json={"email": "newvictim@example.com"}
    )
    # Expect 404 when the user was deleted before the update attempt
    assert resp.status_code == 404
    body = resp.json()
    assert body.get("success") is False


@pytest.mark.asyncio
async def test_admin_update_user_email_to_same_value_different_case(
    admin_client, test_user, test_db
):
    """Updating email to same value but different case should either succeed (normalized) or be treated as no-op; expect 200 and normalized email in DB."""
    # Ensure test_user has lowercase email
    original_email = test_user.email.lower()
    assert test_user.email == original_email

    # Attempt to change to same email with different case
    new_email = original_email.upper()
    resp = await admin_client.put(f"/users/{test_user.id}", json={"email": new_email})

    # We expect the API to normalize emails and accept case-only changes -> 200
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["email"] == original_email
    # Verify persisted
    persisted = await test_db.get(User, test_user.id)
    assert persisted.email == original_email


@pytest.mark.asyncio
async def test_admin_update_user_email_conflict_with_deleted_account(
    admin_client, test_db
):
    """If an email exists on a soft-deleted account, creating/updating should conflict or be rejected depending on policy; assert consistent error code and message."""
    ph = PasswordHasher()

    # Create a user and simulate soft-delete by setting is_active=False
    soft = User(
        email="soft@example.com",
        hashed_password=ph.hash("pass12345"),
        name="Soft",
        role="user",
        is_active=False,
    )
    test_db.add(soft)
    await test_db.commit()

    # Create another user to be updated
    other = User(
        email="other@example.com",
        hashed_password=ph.hash("pass12345"),
        name="Other",
        role="user",
    )
    test_db.add(other)
    await test_db.commit()

    # Try to update 'other' to the soft-deleted user's email
    resp = await admin_client.put(
        f"/users/{other.id}", json={"email": "soft@example.com"}
    )
    # Policy: soft-deleted emails are reserved -> updating to that email should conflict
    assert resp.status_code == 409
    body = resp.json()
    assert body.get("success") is False
