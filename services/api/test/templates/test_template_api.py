"""API endpoint tests for template operations — authentication, authorization, HTTP contracts."""

import pytest
from httpx import AsyncClient

# ============================================================================
# AUTHENTICATION & AUTHORIZATION TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_create_template_requires_authentication(client: AsyncClient):
    """Test that creating template requires authentication."""
    response = await client.post(
        "/templates/",
        json={
            "name": "Test Template",
            "description": "Test",
            "category": "automation",
            "workflow_data": {"nodes": []},
            "is_public": False,
        },
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_templates_requires_authentication(client: AsyncClient):
    """Test that listing templates requires authentication."""
    response = await client.get("/templates/")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_template_requires_authentication(
    client: AsyncClient, sample_public_template
):
    """Test that getting template requires authentication."""
    response = await client.get(f"/templates/{sample_public_template.id}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_delete_template_requires_authentication(
    client: AsyncClient, sample_public_template
):
    """Test that deleting template requires authentication."""
    response = await client.delete(f"/templates/{sample_public_template.id}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_use_template_requires_authentication(
    client: AsyncClient, sample_public_template
):
    """Test that using template requires authentication."""
    response = await client.post(f"/templates/{sample_public_template.id}/use")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_other_users_private_template_forbidden(
    authenticated_client: AsyncClient, other_user_private_template
):
    """Test that accessing another user's private template returns 403."""
    response = await authenticated_client.get(
        f"/templates/{other_user_private_template.id}"
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_delete_other_users_template_forbidden(
    authenticated_client: AsyncClient, other_user_private_template
):
    """Test that deleting another user's template returns 403."""
    response = await authenticated_client.delete(
        f"/templates/{other_user_private_template.id}"
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_use_other_users_private_template_forbidden(
    authenticated_client: AsyncClient, other_user_private_template
):
    """Test that using another user's private template returns 403."""
    response = await authenticated_client.post(
        f"/templates/{other_user_private_template.id}/use"
    )
    assert response.status_code == 403


# ============================================================================
# HTTP STATUS & RESPONSE FORMAT TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_create_template_returns_201(authenticated_client: AsyncClient):
    """Test that successful creation returns 201."""
    response = await authenticated_client.post(
        "/templates/",
        json={
            "name": "Test Template",
            "description": "Test",
            "category": "automation",
            "workflow_data": {"nodes": []},
            "is_public": False,
        },
    )
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_create_template_response_has_success_and_data(
    authenticated_client: AsyncClient,
):
    """Test that create response has success flag and data."""
    response = await authenticated_client.post(
        "/templates/",
        json={
            "name": "Test Template",
            "description": "Test",
            "category": "automation",
            "workflow_data": {"nodes": []},
            "is_public": False,
        },
    )
    data = response.json()
    assert data["success"] is True
    assert "data" in data
    assert "id" in data["data"]


@pytest.mark.asyncio
async def test_list_templates_returns_200(authenticated_client: AsyncClient):
    """Test that list returns 200."""
    response = await authenticated_client.get("/templates/")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_list_templates_response_is_array(authenticated_client: AsyncClient):
    """Test that list response data is an array."""
    response = await authenticated_client.get("/templates/")
    data = response.json()
    assert isinstance(data["data"], list)


@pytest.mark.asyncio
async def test_get_template_returns_200(
    authenticated_client: AsyncClient, sample_public_template
):
    """Test that get returns 200."""
    response = await authenticated_client.get(f"/templates/{sample_public_template.id}")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_template_returns_404_for_nonexistent(
    authenticated_client: AsyncClient,
):
    """Test that get returns 404 for non-existent template."""
    response = await authenticated_client.get("/templates/99999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_template_returns_204(
    authenticated_client: AsyncClient, sample_private_template
):
    """Test that delete returns 204 (no content)."""
    response = await authenticated_client.delete(
        f"/templates/{sample_private_template.id}"
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_nonexistent_template_returns_404(
    authenticated_client: AsyncClient,
):
    """Test that delete returns 404 for non-existent template."""
    response = await authenticated_client.delete("/templates/99999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_use_template_returns_200(
    authenticated_client: AsyncClient, sample_public_template
):
    """Test that use returns 200."""
    response = await authenticated_client.post(
        f"/templates/{sample_public_template.id}/use"
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_use_nonexistent_template_returns_404(
    authenticated_client: AsyncClient,
):
    """Test that use returns 404 for non-existent template."""
    response = await authenticated_client.post("/templates/99999/use")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_use_template_response_includes_workflow_data(
    authenticated_client: AsyncClient, sample_public_template
):
    """Test that use response includes workflow_data."""
    response = await authenticated_client.post(
        f"/templates/{sample_public_template.id}/use"
    )
    data = response.json()["data"]
    assert "workflow_data" in data


# ============================================================================
# REQUEST VALIDATION TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_create_template_wrong_data_types_returns_422(
    authenticated_client: AsyncClient,
):
    """Test that wrong data types return 422."""
    response = await authenticated_client.post(
        "/templates/",
        json={
            "name": 12345,  # Should be string
            "category": True,  # Should be string
            "workflow_data": "not a dict",  # Should be dict
            "is_public": "yes",  # Should be bool
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_template_invalid_json_returns_422(
    authenticated_client: AsyncClient,
):
    """Test that malformed JSON returns 422."""
    response = await authenticated_client.post(
        "/templates/",
        content='{"name": "test", "category": "automation"',  # Malformed
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_template_invalid_id_format_returns_422(
    authenticated_client: AsyncClient,
):
    """Test that invalid ID format returns 422."""
    response = await authenticated_client.get("/templates/invalid-id")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_template_rejects_empty_workflow_data(
    authenticated_client: AsyncClient,
):
    """Templates must include non-empty workflow_data; reject empty templates."""
    response = await authenticated_client.post(
        "/templates/",
        json={
            "name": "Empty Data Template",
            "description": "Test",
            "category": "automation",
            "workflow_data": {},  # empty workflow_data should be rejected
            "is_public": False,
        },
    )

    # Service requirement: do not allow creating an 'empty' template
    assert response.status_code == 422


# ============================================================================
# LIST VISIBILITY TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_list_includes_public_templates(
    authenticated_client: AsyncClient, sample_public_template
):
    """Test that list includes public templates."""
    response = await authenticated_client.get("/templates/")
    template_ids = [t["id"] for t in response.json()["data"]]
    assert sample_public_template.id in template_ids


@pytest.mark.asyncio
async def test_list_includes_own_private_templates(
    authenticated_client: AsyncClient, sample_private_template
):
    """Test that list includes user's own private templates."""
    response = await authenticated_client.get("/templates/")
    template_ids = [t["id"] for t in response.json()["data"]]
    assert sample_private_template.id in template_ids


@pytest.mark.asyncio
async def test_list_excludes_other_users_private_templates(
    authenticated_client: AsyncClient, other_user_private_template
):
    """Test that list excludes other users' private templates."""
    response = await authenticated_client.get("/templates/")
    template_ids = [t["id"] for t in response.json()["data"]]
    assert other_user_private_template.id not in template_ids


@pytest.mark.asyncio
async def test_get_includes_full_workflow_data(
    authenticated_client: AsyncClient, sample_public_template
):
    """Test that get includes full workflow_data."""
    response = await authenticated_client.get(f"/templates/{sample_public_template.id}")
    data = response.json()["data"]
    assert "workflow_data" in data
