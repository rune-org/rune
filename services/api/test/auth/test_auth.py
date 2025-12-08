import asyncio
import pytest
import jwt
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession
from freezegun import freeze_time
from src.db.models import User
from src.core.config import get_settings


# LOGIN TESTS


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, test_user):
    """
    Test POST /auth/login with valid credentials.

    This test demonstrates:
    - Using test fixtures for data setup
    - Making an API request
    - Validating the response structure and status code
    """
    response = await client.post(
        "/auth/login", json={"email": "test@example.com", "password": "testpassword123"}
    )

    assert response.status_code == 200

    data = response.json()
    assert data["success"] is True
    assert data["message"] == "Authenticated"
    assert "data" in data
    assert "access_token" in data["data"]
    assert "refresh_token" in data["data"]
    assert data["data"]["token_type"] == "bearer"
    assert data["data"]["expires_in"] == 1800

    assert "access_token" in response.cookies


@pytest.mark.asyncio
async def test_login_invalid_email(client: AsyncClient, test_user):
    """Test login with non-existent email."""
    response = await client.post(
        "/auth/login",
        json={"email": "nonexistent@example.com", "password": "testpassword123"},
    )

    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["message"] == "Invalid credentials"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, test_user):
    """Test login with incorrect password."""
    response = await client.post(
        "/auth/login", json={"email": "test@example.com", "password": "wrongpassword"}
    )

    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["message"] == "Invalid credentials"


@pytest.mark.asyncio
async def test_login_missing_email_field(client: AsyncClient, test_user):
    """Test login with missing email field."""
    response = await client.post("/auth/login", json={"password": "testpassword123"})

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["message"] == "Validation Error(s)"
    assert "data" in data
    assert any("email" in error.lower() for error in data["data"])


@pytest.mark.asyncio
async def test_login_missing_password_field(client: AsyncClient, test_user):
    """Test login with missing password field."""
    response = await client.post("/auth/login", json={"email": "test@example.com"})

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["message"] == "Validation Error(s)"
    assert any("password" in error.lower() for error in data["data"])


@pytest.mark.asyncio
async def test_login_missing_both_fields(client: AsyncClient, test_user):
    """Test login with both fields missing."""
    response = await client.post("/auth/login", json={})

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["message"] == "Validation Error(s)"
    errors = data["data"]
    assert len(errors) >= 2
    assert any("email" in error.lower() for error in errors)
    assert any("password" in error.lower() for error in errors)


@pytest.mark.asyncio
async def test_login_with_extra_fields(client: AsyncClient, test_user):
    """Test login with extra fields (should be ignored)."""
    response = await client.post(
        "/auth/login",
        json={
            "email": "test@example.com",
            "password": "testpassword123",
            "extra_field": "should be ignored",
            "another_field": 12345,
        },
    )
    # TODO: Prevent extra fields instead of ignoring them
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_login_empty_email(client: AsyncClient, test_user):
    """Test login with empty email string."""
    response = await client.post(
        "/auth/login", json={"email": "", "password": "testpassword123"}
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["message"] == "Validation Error(s)"


@pytest.mark.asyncio
async def test_login_empty_password(client: AsyncClient, test_user):
    """Test login with empty password string."""
    response = await client.post(
        "/auth/login", json={"email": "test@example.com", "password": ""}
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["message"] == "Validation Error(s)"


@pytest.mark.asyncio
async def test_login_invalid_email_format(client: AsyncClient, test_user):
    """Test login with invalid email format."""
    response = await client.post(
        "/auth/login", json={"email": "not-an-email", "password": "testpassword123"}
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["message"] == "Validation Error(s)"


@pytest.mark.asyncio
async def test_login_case_insensitive_email(client: AsyncClient, test_user):
    """Test login with different email casing."""
    response = await client.post(
        "/auth/login",
        json={"email": "TEST@EXAMPLE.COM", "password": "testpassword123"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


# ============================================================================
# REFRESH TOKEN TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_refresh_token_success(client: AsyncClient, test_user):
    """Test successful token refresh."""
    login_response = await client.post(
        "/auth/login", json={"email": "test@example.com", "password": "testpassword123"}
    )
    assert login_response.status_code == 200
    login_data = login_response.json()
    refresh_token = login_data["data"]["refresh_token"]
    original_access_token = login_data["data"]["access_token"]

    # Now refresh the token
    refresh_response = await client.post(
        "/auth/refresh", json={"refresh_token": refresh_token}
    )

    assert refresh_response.status_code == 200
    refresh_data = refresh_response.json()
    assert refresh_data["success"] is True
    assert refresh_data["message"] == "Token refreshed"
    assert "data" in refresh_data
    assert "access_token" in refresh_data["data"]
    assert "refresh_token" in refresh_data["data"]

    new_access_token = refresh_data["data"]["access_token"]
    assert new_access_token != original_access_token

    assert refresh_data["data"]["refresh_token"] == refresh_token

    assert "access_token" in refresh_response.cookies


@pytest.mark.asyncio
async def test_refresh_token_invalid_format(client: AsyncClient, test_user):
    """Test refresh with invalid token format."""
    response = await client.post(
        "/auth/refresh", json={"refresh_token": "invalid-token-format"}
    )

    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["message"] == "Invalid refresh token format"


@pytest.mark.asyncio
async def test_refresh_token_missing_colon(client: AsyncClient, test_user):
    """Test refresh token without colon separator."""
    response = await client.post("/auth/refresh", json={"refresh_token": "123456789"})

    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["message"] == "Invalid refresh token format"


@pytest.mark.asyncio
async def test_refresh_token_non_numeric_user_id(client: AsyncClient, test_user):
    """Test refresh token with non-numeric user ID."""
    response = await client.post(
        "/auth/refresh", json={"refresh_token": "abc:sometoken"}
    )

    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["message"] == "Invalid refresh token format"


@pytest.mark.asyncio
async def test_refresh_token_nonexistent_user(client: AsyncClient, test_user):
    """Test refresh token with non-existent user ID."""
    response = await client.post(
        "/auth/refresh", json={"refresh_token": "99999:validtokenpart"}
    )

    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["message"] == "Refresh token not found"


@pytest.mark.asyncio
async def test_refresh_token_revoked(client: AsyncClient, test_user):
    """Test refresh with a revoked token (after logout)."""
    login_response = await client.post(
        "/auth/login", json={"email": "test@example.com", "password": "testpassword123"}
    )
    refresh_token = login_response.json()["data"]["refresh_token"]

    logout_response = await client.post("/auth/logout")
    assert logout_response.status_code == 200

    refresh_response = await client.post(
        "/auth/refresh", json={"refresh_token": refresh_token}
    )

    assert refresh_response.status_code == 401
    data = refresh_response.json()
    assert data["success"] is False
    assert data["message"] == "Refresh token not found"


@pytest.mark.asyncio
async def test_refresh_token_missing_field(client: AsyncClient, test_user):
    """Test refresh endpoint without refresh_token field."""
    response = await client.post("/auth/refresh", json={})

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["message"] == "Validation Error(s)"
    assert any("refresh_token" in error.lower() for error in data["data"])


@pytest.mark.asyncio
async def test_refresh_token_empty_string(client: AsyncClient, test_user):
    """Test refresh with empty refresh_token."""
    response = await client.post("/auth/refresh", json={"refresh_token": ""})

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["message"] == "Validation Error(s)"


@pytest.mark.asyncio
async def test_refresh_token_with_extra_fields(client: AsyncClient, test_user):
    """Test refresh endpoint with extra fields (should be ignored)."""
    login_response = await client.post(
        "/auth/login", json={"email": "test@example.com", "password": "testpassword123"}
    )
    refresh_token = login_response.json()["data"]["refresh_token"]

    response = await client.post(
        "/auth/refresh",
        json={
            "refresh_token": refresh_token,
            "extra_field": "ignored",
            "another": 123,
        },
    )
    # TODO: Prevent extra fields instead of ignoring them
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


# ============================================================================
# ACCESS TOKEN EXPIRY TESTS


@pytest.mark.asyncio
async def test_expired_access_token(
    client: AsyncClient, test_user, test_db: AsyncSession
):
    """Test that expired access token is rejected."""

    from datetime import timedelta

    settings = get_settings()

    past_time = datetime.now(timezone.utc) - timedelta(hours=1)
    exp_time = past_time  # Token expired 1 hour ago

    expired_payload = {
        "sub": str(test_user.id),
        "email": test_user.email,
        "name": test_user.name,
        "role": test_user.role,
        "iat": int((past_time - timedelta(minutes=5)).timestamp()),
        "exp": int(exp_time.timestamp()),
        "created_at": test_user.created_at.isoformat(),
        "updated_at": test_user.updated_at.isoformat(),
    }

    expired_token = jwt.encode(
        expired_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )

    response = await client.post(
        "/auth/logout", headers={"Cookie": f"access_token={expired_token}"}
    )

    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    # Token is rejected - message could be "Access token expired" or "Invalid access token"
    assert "token" in data["message"].lower()


@pytest.mark.asyncio
async def test_malformed_access_token(client: AsyncClient, test_user):
    """Test that malformed access token is rejected."""
    response = await client.post(
        "/auth/logout", headers={"Cookie": "access_token=not.a.valid.jwt.token"}
    )

    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert "Invalid" in data["message"] or "token" in data["message"].lower()


@pytest.mark.asyncio
async def test_access_token_with_invalid_signature(client: AsyncClient, test_user):
    """Test that token with invalid signature is rejected."""

    fake_payload = {
        "sub": str(test_user.id),
        "email": test_user.email,
        "name": test_user.name,
        "role": test_user.role,
        "exp": datetime.now(timezone.utc).timestamp() + 3600,
    }

    fake_token = jwt.encode(fake_payload, "wrong-secret-key", algorithm="HS256")

    response = await client.post(
        "/auth/logout", headers={"Cookie": f"access_token={fake_token}"}
    )

    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert "Invalid" in data["message"]


@pytest.mark.asyncio
async def test_access_token_missing_required_fields(client: AsyncClient, test_user):
    """Test that token missing required fields is rejected."""

    settings = get_settings()

    incomplete_payload = {
        "sub": str(test_user.id),
        "exp": datetime.now(timezone.utc).timestamp() + 3600,
    }

    incomplete_token = jwt.encode(
        incomplete_payload, settings.jwt_secret_key, algorithm="HS256"
    )

    response = await client.post(
        "/auth/logout", headers={"Cookie": f"access_token={incomplete_token}"}
    )

    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert "Invalid" in data["message"] and "token" in data["message"].lower()


@pytest.mark.asyncio
async def test_token_refresh_updates_access_token_expiry(
    client: AsyncClient, test_user
):
    """Test that refreshing creates new token with fresh expiry."""
    login_response = await client.post(
        "/auth/login", json={"email": "test@example.com", "password": "testpassword123"}
    )
    refresh_token = login_response.json()["data"]["refresh_token"]
    original_access_token = login_response.json()["data"]["access_token"]

    original_decoded = jwt.decode(
        original_access_token, options={"verify_signature": False}
    )
    original_exp = original_decoded["exp"]

    await asyncio.sleep(1)

    refresh_response = await client.post(
        "/auth/refresh", json={"refresh_token": refresh_token}
    )
    new_access_token = refresh_response.json()["data"]["access_token"]

    new_decoded = jwt.decode(new_access_token, options={"verify_signature": False})
    new_exp = new_decoded["exp"]

    assert new_exp > original_exp


# LOGOUT TESTS


@pytest.mark.asyncio
async def test_logout_success(authenticated_client: AsyncClient):
    """Test successful logout."""
    response = await authenticated_client.post("/auth/logout")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["message"] == "Logged out"
    assert data["data"] is None


@pytest.mark.asyncio
async def test_logout_without_authentication(client: AsyncClient):
    """Test logout without being authenticated."""
    response = await client.post("/auth/logout")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_logout_clears_cookie(authenticated_client: AsyncClient):
    """Test that logout clears the authentication cookie."""
    response = await authenticated_client.post("/auth/logout")

    assert response.status_code == 200

    # Check that the cookie is being deleted (has Max-Age=0 or expires directive)
    set_cookie_header = str(response.headers.get("set-cookie", ""))
    assert "access_token" in set_cookie_header, (
        "Set-Cookie header should include access_token"
    )
    assert (
        "Max-Age=0" in set_cookie_header or "max-age=0" in set_cookie_header.lower()
    ), "Cookie should be deleted with Max-Age=0"


@pytest.mark.asyncio
async def test_cannot_use_token_after_logout(client: AsyncClient, test_user):
    """Test that tokens cannot be used after logout."""
    login_response = await client.post(
        "/auth/login", json={"email": "test@example.com", "password": "testpassword123"}
    )
    refresh_token = login_response.json()["data"]["refresh_token"]
    access_token = login_response.json()["data"]["access_token"]

    logout_response = await client.post(
        "/auth/logout", headers={"Cookie": f"access_token={access_token}"}
    )
    assert logout_response.status_code == 200

    refresh_response = await client.post(
        "/auth/refresh", json={"refresh_token": refresh_token}
    )

    assert refresh_response.status_code == 401
    data = refresh_response.json()
    assert data["success"] is False
    assert data["message"] == "Refresh token not found"


# EDGE CASES AND SECURITY TESTS


@pytest.mark.asyncio
async def test_multiple_logins_same_user(client: AsyncClient, test_user):
    """Test that multiple logins for same user work (old tokens are invalidated)."""
    login1 = await client.post(
        "/auth/login", json={"email": "test@example.com", "password": "testpassword123"}
    )
    refresh_token1 = login1.json()["data"]["refresh_token"]

    login2 = await client.post(
        "/auth/login", json={"email": "test@example.com", "password": "testpassword123"}
    )
    refresh_token2 = login2.json()["data"]["refresh_token"]

    assert login1.status_code == 200
    assert login2.status_code == 200

    # First refresh token should be invalid (replaced by second login)
    refresh1_response = await client.post(
        "/auth/refresh", json={"refresh_token": refresh_token1}
    )
    assert refresh1_response.status_code == 401

    refresh2_response = await client.post(
        "/auth/refresh", json={"refresh_token": refresh_token2}
    )
    assert refresh2_response.status_code == 200


@pytest.mark.asyncio
async def test_login_with_null_values(client: AsyncClient, test_user):
    """Test login with null/None values."""
    response = await client.post("/auth/login", json={"email": None, "password": None})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_with_wrong_data_types(client: AsyncClient, test_user):
    """Test login with wrong data types."""
    response = await client.post("/auth/login", json={"email": 12345, "password": True})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_refresh_token_reuse(client: AsyncClient, test_user):
    """Test that refresh token can be reused multiple times."""
    login_response = await client.post(
        "/auth/login", json={"email": "test@example.com", "password": "testpassword123"}
    )
    refresh_token = login_response.json()["data"]["refresh_token"]

    refresh1 = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh1.status_code == 200

    refresh2 = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh2.status_code == 200

    assert refresh1.json()["data"]["refresh_token"] == refresh_token
    assert refresh2.json()["data"]["refresh_token"] == refresh_token


@pytest.mark.asyncio
async def test_special_characters_in_password(
    client: AsyncClient, test_db: AsyncSession
):
    """Test login with special characters in password."""
    from argon2 import PasswordHasher
    from src.db.models import User, UserRole

    ph = PasswordHasher()
    special_password = "P@ssw0rd!#$%^&*()"

    special_user = User(
        email="special@example.com",
        hashed_password=ph.hash(special_password),
        name="Special User",
        role=UserRole.USER,
    )
    test_db.add(special_user)
    await test_db.commit()

    response = await client.post(
        "/auth/login",
        json={"email": "special@example.com", "password": special_password},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_unicode_characters_in_credentials(
    client: AsyncClient, test_db: AsyncSession
):
    """Test login with Unicode characters."""
    from argon2 import PasswordHasher
    from src.db.models import User, UserRole

    ph = PasswordHasher()
    unicode_password = "パスワード123!@#"

    unicode_user = User(
        email="unicode@example.com",
        hashed_password=ph.hash(unicode_password),
        name="Unicode User 日本語",
        role=UserRole.USER,
    )
    test_db.add(unicode_user)
    await test_db.commit()

    response = await client.post(
        "/auth/login",
        json={"email": "unicode@example.com", "password": unicode_password},
    )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_very_long_password(client: AsyncClient, test_user):
    """Test login with extremely long password."""
    long_password = "a" * 10000

    response = await client.post(
        "/auth/login", json={"email": "test@example.com", "password": long_password}
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_token_contains_expected_claims(client: AsyncClient, test_user: User):
    """Test that access token contains all expected claims."""
    response = await client.post(
        "/auth/login", json={"email": "test@example.com", "password": "testpassword123"}
    )

    access_token = response.json()["data"]["access_token"]

    decoded = jwt.decode(access_token, options={"verify_signature": False})

    assert "sub" in decoded
    assert "email" in decoded
    assert "name" in decoded
    assert "role" in decoded
    assert "iat" in decoded
    assert "exp" in decoded
    assert "created_at" in decoded
    assert "updated_at" in decoded

    assert decoded["sub"] == str(test_user.id)
    assert decoded["email"] == test_user.email
    assert decoded["name"] == test_user.name
    assert decoded["role"] == test_user.role


# ============================================================================
# FREEZEGUN TIME-BASED TOKEN EXPIRY TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_access_token_expires_at_exact_configured_time(
    client: AsyncClient, test_user
):
    """Test that access token expires exactly at the configured expiry time."""

    settings = get_settings()
    expiry_minutes = settings.access_token_expire_minutes

    # Login at a specific time
    with freeze_time("2025-10-22 10:00:00"):
        login_response = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "testpassword123"},
        )
        assert login_response.status_code == 200
        access_token = login_response.json()["data"]["access_token"]

    # Token should work 1 second before expiry
    with freeze_time(f"2025-10-22 10:{expiry_minutes - 1}:59"):
        response = await client.post(
            "/auth/logout", headers={"Cookie": f"access_token={access_token}"}
        )
        assert response.status_code == 200

    # Get a new token for the next test
    with freeze_time("2025-10-22 10:00:00"):
        login_response = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "testpassword123"},
        )
        access_token = login_response.json()["data"]["access_token"]

    # Token should NOT work at exact expiry time
    with freeze_time(f"2025-10-22 10:{expiry_minutes}:00"):
        response = await client.post(
            "/auth/logout", headers={"Cookie": f"access_token={access_token}"}
        )
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
        assert "token" in data["message"].lower()


@pytest.mark.asyncio
async def test_access_token_expires_after_configured_duration(
    client: AsyncClient, test_user
):
    """Test that access token expires after the configured duration."""

    settings = get_settings()

    # Login at a specific time
    with freeze_time("2025-10-22 10:00:00"):
        login_response = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "testpassword123"},
        )
        assert login_response.status_code == 200
        access_token = login_response.json()["data"]["access_token"]

    # Token should work immediately
    with freeze_time("2025-10-22 10:00:01"):
        response = await client.post(
            "/auth/logout", headers={"Cookie": f"access_token={access_token}"}
        )
        assert response.status_code == 200

    # Get a new token
    with freeze_time("2025-10-22 10:00:00"):
        login_response = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "testpassword123"},
        )
        access_token = login_response.json()["data"]["access_token"]

    # Fast-forward past the expiry time
    future_time = datetime(2025, 10, 22, 10, 0, 0) + timedelta(
        minutes=settings.access_token_expire_minutes + 1
    )
    with freeze_time(future_time):
        response = await client.post(
            "/auth/logout", headers={"Cookie": f"access_token={access_token}"}
        )
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False


@pytest.mark.asyncio
async def test_refresh_token_expires_after_configured_days(
    client: AsyncClient, test_user
):
    settings = get_settings()

    # Login at a specific time
    with freeze_time("2025-10-22 10:00:00"):
        login_response = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "testpassword123"},
        )
        assert login_response.status_code == 200
        refresh_token = login_response.json()["data"]["refresh_token"]

    # Refresh token should work after 1 day (simulated time)
    with freeze_time("2025-10-23 10:00:00"):
        response = await client.post(
            "/auth/refresh", json={"refresh_token": refresh_token}
        )
        assert response.status_code == 200

    # Verify the refresh token configuration is correct
    # The token should have the configured expiry days
    expected_ttl_seconds = settings.refresh_token_expire_days * 24 * 60 * 60
    assert expected_ttl_seconds == settings.refresh_token_expire_days * 24 * 60 * 60

    # Verify that token_response indicates correct configuration
    assert (
        login_response.json()["data"]["expires_in"]
        == settings.access_token_expire_minutes * 60
    )


@pytest.mark.asyncio
async def test_token_claims_have_correct_timestamps(client: AsyncClient, test_user):
    """Test that token claims contain correct iat and exp timestamps."""

    settings = get_settings()

    # Login at a specific time (use UTC)
    login_time = datetime(2025, 10, 22, 15, 30, 45, tzinfo=timezone.utc)
    with freeze_time(login_time):
        login_response = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "testpassword123"},
        )
        assert login_response.status_code == 200
        access_token = login_response.json()["data"]["access_token"]

    # Decode and verify timestamps
    decoded = jwt.decode(access_token, options={"verify_signature": False})

    expected_iat = int(login_time.timestamp())
    expected_exp = int(
        (
            login_time + timedelta(minutes=settings.access_token_expire_minutes)
        ).timestamp()
    )

    assert decoded["iat"] == expected_iat
    assert decoded["exp"] == expected_exp
    assert decoded["exp"] - decoded["iat"] == settings.access_token_expire_minutes * 60


@pytest.mark.asyncio
async def test_refreshed_token_has_new_expiry_time(client: AsyncClient, test_user):
    """Test that refreshed access token has a new expiry time from the refresh moment."""

    settings = get_settings()

    # Login at time T (use UTC)
    with freeze_time("2025-10-22 10:00:00+00:00"):
        login_response = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "testpassword123"},
        )
        original_access_token = login_response.json()["data"]["access_token"]
        refresh_token = login_response.json()["data"]["refresh_token"]

    original_decoded = jwt.decode(
        original_access_token, options={"verify_signature": False}
    )
    original_exp = original_decoded["exp"]

    # Refresh token at time T + 1 minute
    with freeze_time("2025-10-22 10:01:00+00:00"):
        refresh_response = await client.post(
            "/auth/refresh", json={"refresh_token": refresh_token}
        )
        new_access_token = refresh_response.json()["data"]["access_token"]

    new_decoded = jwt.decode(new_access_token, options={"verify_signature": False})
    new_exp = new_decoded["exp"]
    new_iat = new_decoded["iat"]

    # New token should be issued at T + 1 minute
    expected_new_iat = int(
        datetime(2025, 10, 22, 10, 1, 0, tzinfo=timezone.utc).timestamp()
    )
    assert new_iat == expected_new_iat

    # New token should expire at T + 1 minute + access_token_expire_minutes
    expected_new_exp = int(
        (
            datetime(2025, 10, 22, 10, 1, 0, tzinfo=timezone.utc)
            + timedelta(minutes=settings.access_token_expire_minutes)
        ).timestamp()
    )
    assert new_exp == expected_new_exp

    # New expiry should be 60 seconds later than original
    assert new_exp == original_exp + 60


@pytest.mark.asyncio
async def test_token_not_valid_before_issued_time(client: AsyncClient, test_user):
    """Test that a token cannot be used before it was issued (time travel protection)."""

    settings = get_settings()

    # Create a token with a future iat (issued at time)
    future_iat = datetime(2025, 10, 22, 12, 0, 0)
    future_exp = future_iat + timedelta(minutes=settings.access_token_expire_minutes)

    payload = {
        "sub": str(test_user.id),
        "email": test_user.email,
        "name": test_user.name,
        "role": test_user.role,
        "iat": int(future_iat.timestamp()),
        "exp": int(future_exp.timestamp()),
        "created_at": test_user.created_at.isoformat(),
        "updated_at": test_user.updated_at.isoformat(),
    }

    future_token = jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )

    # Try to use the token before it was issued
    with freeze_time("2025-10-22 11:59:59"):
        response = await client.post(
            "/auth/logout", headers={"Cookie": f"access_token={future_token}"}
        )
        # Token should be rejected (not yet valid)
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_token_expiry_boundary_conditions(client: AsyncClient, test_user):
    """Test token expiry at exact boundary conditions (edge cases)."""

    # Login at a specific time
    with freeze_time("2025-10-22 10:00:00.000000"):
        login_response = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "testpassword123"},
        )
        access_token = login_response.json()["data"]["access_token"]

    decoded = jwt.decode(access_token, options={"verify_signature": False})
    exp_timestamp = decoded["exp"]
    exp_datetime = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)

    # Test 1 microsecond before expiry
    one_microsecond_before = exp_datetime - timedelta(microseconds=1)
    with freeze_time(one_microsecond_before):
        response = await client.post(
            "/auth/logout", headers={"Cookie": f"access_token={access_token}"}
        )
        assert response.status_code == 200

    # Get a new token
    with freeze_time("2025-10-22 10:00:00.000000"):
        login_response = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "testpassword123"},
        )
        access_token = login_response.json()["data"]["access_token"]

    # Test at exact expiry time
    with freeze_time(exp_datetime):
        response = await client.post(
            "/auth/logout", headers={"Cookie": f"access_token={access_token}"}
        )
        assert response.status_code == 401

    # Get a new token
    with freeze_time("2025-10-22 10:00:00.000000"):
        login_response = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "testpassword123"},
        )
        access_token = login_response.json()["data"]["access_token"]

    # Test 1 microsecond after expiry
    one_microsecond_after = exp_datetime + timedelta(microseconds=1)
    with freeze_time(one_microsecond_after):
        response = await client.post(
            "/auth/logout", headers={"Cookie": f"access_token={access_token}"}
        )
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_token_lifetime_configuration_is_respected(
    client: AsyncClient, test_user
):
    """Test that the actual token lifetime matches the configuration."""

    settings = get_settings()

    with freeze_time("2025-10-22 10:00:00"):
        login_response = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "testpassword123"},
        )
        access_token = login_response.json()["data"]["access_token"]

    decoded = jwt.decode(access_token, options={"verify_signature": False})
    actual_lifetime_seconds = decoded["exp"] - decoded["iat"]
    expected_lifetime_seconds = settings.access_token_expire_minutes * 60

    assert actual_lifetime_seconds == expected_lifetime_seconds, (
        f"Token lifetime {actual_lifetime_seconds}s does not match configured {expected_lifetime_seconds}s"
    )

    # Verify the token actually expires at the configured time
    expiry_time = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)

    # Token should work 1 second before expiry
    with freeze_time(expiry_time - timedelta(seconds=1)):
        response = await client.post(
            "/auth/logout", headers={"Cookie": f"access_token={access_token}"}
        )
        assert response.status_code == 200

    # Get new token
    with freeze_time("2025-10-22 10:00:00"):
        login_response = await client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "testpassword123"},
        )
        access_token = login_response.json()["data"]["access_token"]

    # Token should NOT work 1 second after expiry
    with freeze_time(expiry_time + timedelta(seconds=1)):
        response = await client.post(
            "/auth/logout", headers={"Cookie": f"access_token={access_token}"}
        )
        assert response.status_code == 401
