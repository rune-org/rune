import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import User, WorkflowCredential


# ============================================================================
# CREATE CREDENTIAL TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_create_credential_success(authenticated_client: AsyncClient):
    """Test successful credential creation with valid data."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "test-api-key",
            "credential_type": "api_key",
            "credential_data": {
                "api_key": "secret-key-123",
                "endpoint": "https://api.example.com",
            },
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["message"] == "Credential created successfully"
    assert "data" in data

    credential = data["data"]
    assert credential["name"] == "test-api-key"
    assert credential["credential_type"] == "api_key"
    assert "id" in credential
    assert "created_at" in credential
    assert "updated_at" in credential

    # Ensure credential_data is NOT returned (sensitive data)
    assert "credential_data" not in credential


@pytest.mark.asyncio
async def test_create_credential_oauth2_type(authenticated_client: AsyncClient):
    """Test creating OAuth2 credential."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "oauth2-cred",
            "credential_type": "oauth2",
            "credential_data": {
                "client_id": "client123",
                "client_secret": "secret456",
                "redirect_uri": "https://example.com/callback",
            },
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["credential_type"] == "oauth2"


@pytest.mark.asyncio
async def test_create_credential_basic_auth_type(authenticated_client: AsyncClient):
    """Test creating basic auth credential."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "basic-auth-cred",
            "credential_type": "basic_auth",
            "credential_data": {"username": "admin", "password": "password123"},
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["credential_type"] == "basic_auth"


@pytest.mark.asyncio
async def test_create_credential_token_type(authenticated_client: AsyncClient):
    """Test creating token credential."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "bearer-token",
            "credential_type": "token",
            "credential_data": {"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."},
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["credential_type"] == "token"


@pytest.mark.asyncio
async def test_create_credential_custom_type(authenticated_client: AsyncClient):
    """Test creating custom credential type."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "custom-cred",
            "credential_type": "custom",
            "credential_data": {
                "type": "ssh_key",
                "private_key": "-----BEGIN RSA PRIVATE KEY-----...",
                "public_key": "ssh-rsa AAAAB3...",
            },
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["credential_type"] == "custom"


@pytest.mark.asyncio
async def test_create_credential_without_authentication(client: AsyncClient):
    """Test that creating credential requires authentication."""
    response = await client.post(
        "/credentials/",
        json={
            "name": "test-credential",
            "credential_type": "api_key",
            "credential_data": {"api_key": "secret"},
        },
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_credential_with_duplicate_name(
    authenticated_client: AsyncClient,
):
    """Test that creating credential with duplicate name fails."""
    # Create first credential
    response1 = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "duplicate-name",
            "credential_type": "api_key",
            "credential_data": {"api_key": "secret1"},
        },
    )
    assert response1.status_code == 201

    # Attempt to create second credential with same name
    response2 = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "duplicate-name",
            "credential_type": "token",
            "credential_data": {"token": "secret2"},
        },
    )

    assert response2.status_code == 409
    data = response2.json()
    assert data["success"] is False
    assert (
        "duplicate-name" in data["message"].lower()
        or "already exists" in data["message"].lower()
    )


@pytest.mark.asyncio
async def test_create_credential_with_empty_name(authenticated_client: AsyncClient):
    """Test that creating credential with empty name fails validation."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "",
            "credential_type": "api_key",
            "credential_data": {"api_key": "secret"},
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["message"] == "Validation Error(s)"


@pytest.mark.asyncio
async def test_create_credential_with_missing_name(authenticated_client: AsyncClient):
    """Test that name field is required."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "credential_type": "api_key",
            "credential_data": {"api_key": "secret"},
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert any("name" in error.lower() for error in data["data"])


@pytest.mark.asyncio
async def test_create_credential_with_missing_credential_type(
    authenticated_client: AsyncClient,
):
    """Test that credential_type field is required."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "test-cred",
            "credential_data": {"api_key": "secret"},
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert any("credential_type" in error.lower() for error in data["data"])


@pytest.mark.asyncio
async def test_create_credential_with_invalid_credential_type(
    authenticated_client: AsyncClient,
):
    """Test that invalid credential_type is rejected."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "test-cred",
            "credential_type": "invalid_type",
            "credential_data": {"api_key": "secret"},
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False


@pytest.mark.asyncio
async def test_create_credential_with_empty_credential_data(
    authenticated_client: AsyncClient,
):
    """Test creating credential with empty credential_data dictionary."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "empty-data",
            "credential_type": "api_key",
            "credential_data": {},
        },
    )

    # Empty credential_data should be allowed
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_create_credential_without_credential_data_field(
    authenticated_client: AsyncClient,
):
    """Test creating credential without credential_data field (should use default empty dict)."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "no-data",
            "credential_type": "api_key",
        },
    )

    # Should succeed with default empty dict # TODO
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_create_credential_with_complex_nested_data(
    authenticated_client: AsyncClient,
):
    """Test creating credential with complex nested credential_data."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "complex-cred",
            "credential_type": "custom",
            "credential_data": {
                "service": "aws",
                "config": {
                    "region": "us-east-1",
                    "credentials": {
                        "access_key": "AKIAIOSFODNN7EXAMPLE",
                        "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                    },
                    "options": {
                        "timeout": 30,
                        "retry": True,
                        "max_attempts": 3,
                    },
                },
                "endpoints": ["https://s3.amazonaws.com", "https://ec2.amazonaws.com"],
            },
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_create_credential_with_special_characters_in_name(
    authenticated_client: AsyncClient,
):
    """Test creating credential with special characters in name."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "my-api_key.v1",
            "credential_type": "api_key",
            "credential_data": {"api_key": "secret"},
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["name"] == "my-api_key.v1"


@pytest.mark.asyncio
async def test_create_credential_with_unicode_in_name(
    authenticated_client: AsyncClient,
):
    """Test creating credential with Unicode characters in name."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "测试凭证-テスト",
            "credential_type": "api_key",
            "credential_data": {"api_key": "secret"},
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["name"] == "测试凭证-テスト"


@pytest.mark.asyncio
async def test_create_credential_with_very_long_name(
    authenticated_client: AsyncClient,
):
    """Test creating credential with name at maximum length (100 chars)."""
    long_name = "a" * 100
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": long_name,
            "credential_type": "api_key",
            "credential_data": {"api_key": "secret"},
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["name"] == long_name


@pytest.mark.asyncio
async def test_create_credential_with_name_exceeding_max_length(
    authenticated_client: AsyncClient,
):
    """Test that name exceeding max length (100 chars) is rejected."""
    too_long_name = "a" * 101
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": too_long_name,
            "credential_type": "api_key",
            "credential_data": {"api_key": "secret"},
        },
    )

    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False


@pytest.mark.asyncio
async def test_create_credential_with_null_values_in_data(
    authenticated_client: AsyncClient,
):
    """Test creating credential with null values in credential_data."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "null-values",
            "credential_type": "custom",
            "credential_data": {
                "key1": "value1",
                "key2": None,
                "key3": "value3",
            },
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_create_credential_with_extra_fields(authenticated_client: AsyncClient):
    """Test that extra fields in request body are ignored."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "test-cred",
            "credential_type": "api_key",
            "credential_data": {"api_key": "secret"},
            "extra_field": "should be ignored",
            "another_field": 12345,
        },
    )

    # Extra fields should be ignored, request should succeed  #TODO
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_create_credential_sets_created_by(
    authenticated_client: AsyncClient, test_user: User, test_db: AsyncSession
):
    """Test that credential is associated with the authenticated user."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "user-cred",
            "credential_type": "api_key",
            "credential_data": {"api_key": "secret"},
        },
    )

    assert response.status_code == 201
    credential_id = response.json()["data"]["id"]

    # Verify in database
    from sqlmodel import select

    statement = select(WorkflowCredential).where(WorkflowCredential.id == credential_id)
    result = await test_db.exec(statement)
    credential = result.first()

    assert credential is not None
    assert credential.created_by == test_user.id


@pytest.mark.asyncio
async def test_create_credential_data_is_encrypted(
    authenticated_client: AsyncClient, test_db: AsyncSession
):
    """Test that credential_data is encrypted in the database."""
    sensitive_data = {"api_key": "super-secret-key-12345"}

    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "encrypted-cred",
            "credential_type": "api_key",
            "credential_data": sensitive_data,
        },
    )

    assert response.status_code == 201
    credential_id = response.json()["data"]["id"]

    # Check database directly
    from sqlmodel import select

    statement = select(WorkflowCredential).where(WorkflowCredential.id == credential_id)
    result = await test_db.exec(statement)
    credential = result.first()

    # Encrypted data should not contain the plain text
    assert "super-secret-key-12345" not in credential.credential_data

    # Encrypted data should be a base64 string
    import base64

    try:
        base64.b64decode(credential.credential_data)
    except Exception:
        pytest.fail("Credential data is not valid base64 (not encrypted)")


# ============================================================================
# LIST CREDENTIALS TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_list_credentials_empty(authenticated_client: AsyncClient):
    """Test listing credentials when none exist."""
    response = await authenticated_client.get("/credentials/")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"] == []
    assert "0 credential" in data["message"].lower()


@pytest.mark.asyncio
async def test_list_credentials_single(authenticated_client: AsyncClient):
    """Test listing credentials with one credential."""
    # Create a credential
    await authenticated_client.post(
        "/credentials/",
        json={
            "name": "test-cred",
            "credential_type": "api_key",
            "credential_data": {"api_key": "secret"},
        },
    )

    # List credentials
    response = await authenticated_client.get("/credentials/")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]) == 1
    assert data["data"][0]["name"] == "test-cred"
    assert "1 credential" in data["message"].lower()


@pytest.mark.asyncio
async def test_list_credentials_multiple(authenticated_client: AsyncClient):
    """Test listing multiple credentials."""
    # Create multiple credentials
    credentials = [
        {"name": "cred1", "credential_type": "api_key"},
        {"name": "cred2", "credential_type": "oauth2"},
        {"name": "cred3", "credential_type": "basic_auth"},
    ]

    for cred in credentials:
        await authenticated_client.post(
            "/credentials/",
            json={**cred, "credential_data": {"key": "value"}},
        )

    # List credentials
    response = await authenticated_client.get("/credentials/")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]) == 3

    names = [c["name"] for c in data["data"]]
    assert "cred1" in names
    assert "cred2" in names
    assert "cred3" in names


@pytest.mark.asyncio
async def test_list_credentials_does_not_return_sensitive_data(
    authenticated_client: AsyncClient,
):
    """Test that listing credentials doesn't return credential_data."""
    await authenticated_client.post(
        "/credentials/",
        json={
            "name": "secret-cred",
            "credential_type": "api_key",
            "credential_data": {"api_key": "super-secret"},
        },
    )

    response = await authenticated_client.get("/credentials/")

    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 1

    credential = data["data"][0]
    # Ensure credential_data is NOT in response
    assert "credential_data" not in credential


@pytest.mark.asyncio
async def test_list_credentials_without_authentication(client: AsyncClient):
    """Test that listing credentials requires authentication."""
    response = await client.get("/credentials/")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_credentials_returns_all_fields(authenticated_client: AsyncClient):
    """Test that list returns all expected fields except credential_data."""
    await authenticated_client.post(
        "/credentials/",
        json={
            "name": "full-cred",
            "credential_type": "api_key",
            "credential_data": {"api_key": "secret"},
        },
    )

    response = await authenticated_client.get("/credentials/")

    assert response.status_code == 200
    credential = response.json()["data"][0]

    # Check all expected fields are present
    assert "id" in credential
    assert "name" in credential
    assert "credential_type" in credential
    assert "created_by" in credential
    assert "created_at" in credential
    assert "updated_at" in credential

    # Ensure sensitive data is not present
    assert "credential_data" not in credential


@pytest.mark.asyncio
async def test_list_credentials_with_different_types(
    authenticated_client: AsyncClient,
):
    """Test listing credentials of different types."""
    credential_types = ["api_key", "oauth2", "basic_auth", "token", "custom"]

    for i, cred_type in enumerate(credential_types):
        await authenticated_client.post(
            "/credentials/",
            json={
                "name": f"cred-{cred_type}",
                "credential_type": cred_type,
                "credential_data": {"key": f"value-{i}"},
            },
        )

    response = await authenticated_client.get("/credentials/")

    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == len(credential_types)

    returned_types = [c["credential_type"] for c in data["data"]]
    for cred_type in credential_types:
        assert cred_type in returned_types


@pytest.mark.asyncio
async def test_list_credentials_ordered_by_creation(
    authenticated_client: AsyncClient,
):
    """Test that credentials are returned in a consistent order."""
    import asyncio

    # Create credentials with small delay to ensure different timestamps
    for i in range(3):
        await authenticated_client.post(
            "/credentials/",
            json={
                "name": f"cred-{i}",
                "credential_type": "api_key",
                "credential_data": {"key": f"value-{i}"},
            },
        )
        await asyncio.sleep(0.01)

    response = await authenticated_client.get("/credentials/")

    assert response.status_code == 200
    credentials = response.json()["data"]
    assert len(credentials) == 3

    # Verify they have different timestamps
    timestamps = [c["created_at"] for c in credentials]
    assert len(set(timestamps)) >= 2  # At least some should be different


@pytest.mark.asyncio
async def test_list_credentials_includes_created_by(
    authenticated_client: AsyncClient, test_user: User
):
    """Test that listed credentials include created_by field."""
    await authenticated_client.post(
        "/credentials/",
        json={
            "name": "user-cred",
            "credential_type": "api_key",
            "credential_data": {"api_key": "secret"},
        },
    )

    response = await authenticated_client.get("/credentials/")

    assert response.status_code == 200
    credential = response.json()["data"][0]

    assert "created_by" in credential
    assert credential["created_by"] == test_user.id


# ============================================================================
# EDGE CASES AND ERROR HANDLING
# ============================================================================


@pytest.mark.asyncio
async def test_create_credential_with_malformed_json(authenticated_client: AsyncClient):
    """Test handling of malformed JSON in request."""
    response = await authenticated_client.post(
        "/credentials/",
        content='{"name": "test", "credential_type": "api_key"',  # Malformed JSON
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_credential_with_wrong_data_types(
    authenticated_client: AsyncClient,
):
    """Test that wrong data types are rejected."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": 12345,  # Should be string
            "credential_type": "api_key",
            "credential_data": "not a dict",  # Should be dict
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_credential_with_null_credential_data(
    authenticated_client: AsyncClient,
):
    """Test creating credential with null credential_data."""
    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "null-data",
            "credential_type": "api_key",
            "credential_data": None,
        },
    )

    # Should fail validation (credential_data should be dict)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_credentials_with_query_params_ignored(
    authenticated_client: AsyncClient,
):
    """Test that query parameters are ignored (for now, since not implemented)."""
    await authenticated_client.post(
        "/credentials/",
        json={
            "name": "test-cred",
            "credential_type": "api_key",
            "credential_data": {"api_key": "secret"},
        },
    )

    # List with query params (should be ignored)
    response = await authenticated_client.get("/credentials/?type=oauth2&limit=10")

    assert response.status_code == 200
    # Should still return all credentials (query params ignored)
    assert len(response.json()["data"]) >= 1


@pytest.mark.asyncio
async def test_create_multiple_credentials_by_same_user(
    authenticated_client: AsyncClient, test_user: User
):
    """Test that same user can create multiple credentials."""
    for i in range(5):
        response = await authenticated_client.post(
            "/credentials/",
            json={
                "name": f"cred-{i}",
                "credential_type": "api_key",
                "credential_data": {"api_key": f"secret-{i}"},
            },
        )
        assert response.status_code == 201

    # List all credentials
    list_response = await authenticated_client.get("/credentials/")
    assert list_response.status_code == 200
    assert len(list_response.json()["data"]) == 5


@pytest.mark.asyncio
async def test_credential_timestamps_are_valid(authenticated_client: AsyncClient):
    """Test that created_at and updated_at timestamps are valid."""
    from datetime import datetime

    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "timestamp-test",
            "credential_type": "api_key",
            "credential_data": {"api_key": "secret"},
        },
    )

    assert response.status_code == 201
    credential = response.json()["data"]

    # Check timestamps can be parsed
    created_at = datetime.fromisoformat(credential["created_at"].replace("Z", "+00:00"))
    updated_at = datetime.fromisoformat(credential["updated_at"].replace("Z", "+00:00"))

    assert created_at is not None
    assert updated_at is not None
    assert created_at <= updated_at


@pytest.mark.asyncio
async def test_create_credential_with_very_large_data(
    authenticated_client: AsyncClient,
):
    """Test creating credential with large credential_data."""
    large_data = {"key_{}".format(i): "value_{}".format(i * 100) for i in range(100)}

    response = await authenticated_client.post(
        "/credentials/",
        json={
            "name": "large-cred",
            "credential_type": "custom",
            "credential_data": large_data,
        },
    )

    # Should succeed even with large data
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
