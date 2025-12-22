import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import User, UserRole


@pytest.mark.asyncio
async def test_first_time_setup_status_when_no_users(client: AsyncClient):
    """
    Test GET /auth/first-time-setup returns requires_setup=True when no users exist.
    """
    response = await client.get("/auth/first-time-setup")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["message"] == "First-time setup status retrieved"
    assert "data" in data
    assert data["data"]["requires_setup"] is True
    assert "first-time setup required" in data["data"]["message"].lower()


@pytest.mark.asyncio
async def test_first_time_setup_status_when_users_exist(
    client: AsyncClient, test_user: User
):
    """
    Test GET /auth/first-time-setup returns requires_setup=False when users exist.
    """
    response = await client.get("/auth/first-time-setup")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["requires_setup"] is False
    assert "already configured" in data["data"]["message"].lower()


# ============================================================================
# FIRST ADMIN SIGNUP SUCCESS TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_first_admin_signup_success(client: AsyncClient):
    """
    Test POST /auth/first-admin-signup creates admin successfully when no users exist.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "First Admin",
            "email": "admin@example.com",
            "password": "SecurePass123!",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["message"] == "First admin account created"
    assert "data" in data
    assert data["data"]["name"] == "First Admin"
    assert data["data"]["email"] == "admin@example.com"
    assert "user_id" in data["data"]
    assert isinstance(data["data"]["user_id"], int)


@pytest.mark.asyncio
async def test_first_admin_signup_creates_admin_role(
    client: AsyncClient, test_db: AsyncSession
):
    """
    Test that first admin signup creates user with ADMIN role.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Admin User",
            "email": "newadmin@example.com",
            "password": "SecurePass123!",
        },
    )

    assert response.status_code == 200
    user_id = response.json()["data"]["user_id"]

    # Verify the user has admin role in database
    user = await test_db.get(User, user_id)
    assert user is not None
    assert user.role == UserRole.ADMIN


@pytest.mark.asyncio
async def test_first_admin_signup_does_not_require_password_change(
    client: AsyncClient, test_db: AsyncSession
):
    """
    Test that first admin signup sets must_change_password=False.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Admin User",
            "email": "newadmin@example.com",
            "password": "SecurePass123!",
        },
    )

    assert response.status_code == 200
    user_id = response.json()["data"]["user_id"]

    # Verify must_change_password is False
    user = await test_db.get(User, user_id)
    assert user is not None
    assert user.must_change_password is False


@pytest.mark.asyncio
async def test_first_admin_can_login_after_signup(client: AsyncClient):
    """
    Test that the first admin can login immediately after signup.
    """
    # Create first admin
    signup_response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Admin User",
            "email": "admin@example.com",
            "password": "SecurePass123!",
        },
    )
    assert signup_response.status_code == 200

    # Login with the created admin
    login_response = await client.post(
        "/auth/login",
        json={
            "email": "admin@example.com",
            "password": "SecurePass123!",
        },
    )

    assert login_response.status_code == 200
    data = login_response.json()
    assert data["success"] is True
    assert "access_token" in data["data"]


@pytest.mark.asyncio
async def test_first_admin_signup_normalizes_email(
    client: AsyncClient, test_db: AsyncSession
):
    """
    Test that first admin signup normalizes email to lowercase.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Admin User",
            "email": "ADMIN@EXAMPLE.COM",
            "password": "SecurePass123!",
        },
    )

    assert response.status_code == 200
    user_id = response.json()["data"]["user_id"]

    # Verify email is normalized
    user = await test_db.get(User, user_id)
    assert user.email == "admin@example.com"


# ============================================================================
# FIRST ADMIN SIGNUP BLOCKED WHEN USERS EXIST
# ============================================================================


@pytest.mark.asyncio
async def test_first_admin_signup_blocked_when_user_exists(
    client: AsyncClient, test_user: User
):
    """
    Test POST /auth/first-admin-signup returns 403 when users already exist.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Another Admin",
            "email": "another@example.com",
            "password": "SecurePass123!",
        },
    )

    assert response.status_code == 403
    data = response.json()
    assert data["success"] is False
    assert "users already exist" in data["message"].lower()


# ============================================================================
# FIRST ADMIN SIGNUP VALIDATION TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_first_admin_signup_missing_name(client: AsyncClient):
    """
    Test first admin signup fails when name is missing.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "email": "admin@example.com",
            "password": "SecurePass123!",
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert any("name" in error.lower() for error in data["data"])


@pytest.mark.asyncio
async def test_first_admin_signup_missing_email(client: AsyncClient):
    """
    Test first admin signup fails when email is missing.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Admin User",
            "password": "SecurePass123!",
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert any("email" in error.lower() for error in data["data"])


@pytest.mark.asyncio
async def test_first_admin_signup_missing_password(client: AsyncClient):
    """
    Test first admin signup fails when password is missing.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Admin User",
            "email": "admin@example.com",
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert any("password" in error.lower() for error in data["data"])


@pytest.mark.asyncio
async def test_first_admin_signup_invalid_email_format(client: AsyncClient):
    """
    Test first admin signup fails with invalid email format.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Admin User",
            "email": "not-an-email",
            "password": "SecurePass123!",
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False


@pytest.mark.asyncio
async def test_first_admin_signup_name_too_short(client: AsyncClient):
    """
    Test first admin signup fails when name is too short (< 3 characters).
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "AB",
            "email": "admin@example.com",
            "password": "SecurePass123!",
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False


@pytest.mark.asyncio
async def test_first_admin_signup_name_too_long(client: AsyncClient):
    """
    Test first admin signup fails when name is too long (> 40 characters).
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "A" * 41,
            "email": "admin@example.com",
            "password": "SecurePass123!",
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False


@pytest.mark.asyncio
async def test_first_admin_signup_password_too_short(client: AsyncClient):
    """
    Test first admin signup fails when password is too short (< 8 characters).
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Admin User",
            "email": "admin@example.com",
            "password": "Short1!",
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False


@pytest.mark.asyncio
async def test_first_admin_signup_weak_password_no_uppercase(client: AsyncClient):
    """
    Test first admin signup fails with password missing uppercase letter.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Admin User",
            "email": "admin@example.com",
            "password": "weakpassword123!",
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False


@pytest.mark.asyncio
async def test_first_admin_signup_weak_password_no_lowercase(client: AsyncClient):
    """
    Test first admin signup fails with password missing lowercase letter.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Admin User",
            "email": "admin@example.com",
            "password": "WEAKPASSWORD123!",
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False


@pytest.mark.asyncio
async def test_first_admin_signup_weak_password_no_digit(client: AsyncClient):
    """
    Test first admin signup fails with password missing digit.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Admin User",
            "email": "admin@example.com",
            "password": "WeakPassword!",
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False


@pytest.mark.asyncio
async def test_first_admin_signup_weak_password_no_special_char(client: AsyncClient):
    """
    Test first admin signup fails with password missing special character.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Admin User",
            "email": "admin@example.com",
            "password": "WeakPassword123",
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False


# ============================================================================
# FIRST TIME SETUP STATUS UPDATES AFTER SIGNUP
# ============================================================================


@pytest.mark.asyncio
async def test_first_time_setup_status_changes_after_signup(client: AsyncClient):
    """
    Test that first-time-setup status changes from true to false after signup.
    """
    # Check initial status
    status_before = await client.get("/auth/first-time-setup")
    assert status_before.json()["data"]["requires_setup"] is True

    # Create first admin
    await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Admin User",
            "email": "admin@example.com",
            "password": "SecurePass123!",
        },
    )

    # Check status after signup
    status_after = await client.get("/auth/first-time-setup")
    assert status_after.json()["data"]["requires_setup"] is False


# ============================================================================
# EDGE CASES AND SPECIAL CHARACTERS
# ============================================================================


@pytest.mark.asyncio
async def test_first_admin_signup_with_unicode_name(
    client: AsyncClient, test_db: AsyncSession
):
    """
    Test first admin signup with Unicode characters in name.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "管理者 Admin 日本語",
            "email": "admin@example.com",
            "password": "SecurePass123!",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["data"]["name"] == "管理者 Admin 日本語"


@pytest.mark.asyncio
async def test_first_admin_signup_with_special_chars_in_password(client: AsyncClient):
    """
    Test first admin signup with special characters in password.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Admin User",
            "email": "admin@example.com",
            "password": "P@$$w0rd!#%^&*()",
        },
    )

    assert response.status_code == 200

    # Verify can login with special password
    login_response = await client.post(
        "/auth/login",
        json={
            "email": "admin@example.com",
            "password": "P@$$w0rd!#%^&*()",
        },
    )
    assert login_response.status_code == 200


@pytest.mark.asyncio
async def test_first_admin_signup_email_case_insensitive_login(client: AsyncClient):
    """
    Test that admin can login with different email casing after signup.
    """
    # Signup with lowercase email
    await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Admin User",
            "email": "admin@example.com",
            "password": "SecurePass123!",
        },
    )

    # Login with uppercase email
    response = await client.post(
        "/auth/login",
        json={
            "email": "ADMIN@EXAMPLE.COM",
            "password": "SecurePass123!",
        },
    )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_first_admin_signup_with_extra_fields(client: AsyncClient):
    """
    Test first admin signup ignores extra fields in request.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "Admin User",
            "email": "admin@example.com",
            "password": "SecurePass123!",
            "extra_field": "should be ignored",
            "role": "user",  # Should be ignored, always creates admin
        },
    )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_first_admin_signup_with_null_values(client: AsyncClient):
    """
    Test first admin signup fails with null values.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": None,
            "email": None,
            "password": None,
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_first_admin_signup_with_empty_strings(client: AsyncClient):
    """
    Test first admin signup fails with empty strings.
    """
    response = await client.post(
        "/auth/first-admin-signup",
        json={
            "name": "",
            "email": "",
            "password": "",
        },
    )

    assert response.status_code == 422
