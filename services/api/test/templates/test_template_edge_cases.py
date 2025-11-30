"""Edge case and boundary tests for template functionality."""

import pytest


class TestEdgeCases:
    """Tests for boundary conditions and edge cases."""

    @pytest.mark.asyncio
    async def test_template_with_maximum_int_id(self, authenticated_client):
        """Should handle very large template IDs gracefully."""
        response = await authenticated_client.get(f"/templates/{2147483647}")
        # Should return 404, not crash
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_null_required_field(self, authenticated_client):
        """Should reject null values for required fields."""
        response = await authenticated_client.post(
            "/templates/",
            json={
                "name": None,
                "description": "",
                "category": "automation",
                "workflow_data": {"nodes": []},
                "is_public": False,
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_very_long_name_accepted(self, authenticated_client):
        """Should accept long template names."""
        long_name = "A" * 255

        response = await authenticated_client.post(
            "/templates/",
            json={
                "name": long_name,
                "description": "",
                "category": "automation",
                "workflow_data": {"nodes": []},
                "is_public": False,
            },
        )

        assert response.status_code in [201, 200]

    @pytest.mark.asyncio
    async def test_very_long_description_accepted(self, authenticated_client):
        """Should accept very long descriptions."""
        long_description = "Description " * 1000

        create_response = await authenticated_client.post(
            "/templates/",
            json={
                "name": "Test Template",
                "description": long_description,
                "category": "automation",
                "workflow_data": {"nodes": []},
                "is_public": False,
            },
        )

        assert create_response.status_code in [201, 200]
        data = create_response.json()
        assert data["data"]["description"] == long_description

    @pytest.mark.asyncio
    async def test_repeated_operations_on_same_template(
        self, authenticated_client, sample_public_template
    ):
        """Should handle repeated operations on same template."""
        for i in range(10):
            response = await authenticated_client.get(
                f"/templates/{sample_public_template.id}"
            )
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_name_must_be_string(self, authenticated_client):
        """Should reject non-string name."""
        response = await authenticated_client.post(
            "/templates/",
            json={
                "name": 123,
                "description": "Test",
                "category": "automation",
                "workflow_data": {"nodes": []},
                "is_public": False,
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_category_must_be_string(self, authenticated_client):
        """Should reject non-string category."""
        response = await authenticated_client.post(
            "/templates/",
            json={
                "name": "Test Template",
                "description": "Test",
                "category": ["automation", "testing"],  # Should be string
                "workflow_data": {"nodes": []},
                "is_public": False,
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_is_public_must_be_boolean(self, authenticated_client):
        """Should reject non-boolean is_public."""
        response = await authenticated_client.post(
            "/templates/",
            json={
                "name": "Test Template",
                "description": "Test",
                "category": "automation",
                "workflow_data": {"nodes": []},
                "is_public": "yes",  # Should be bool
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_workflow_data_must_be_dict(self, authenticated_client):
        """Should reject non-dict workflow_data."""
        response = await authenticated_client.post(
            "/templates/",
            json={
                "name": "Test Template",
                "description": "Test",
                "category": "automation",
                "workflow_data": "not a dict",  # Should be dict
                "is_public": False,
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_zero_usage_count_on_creation(self, authenticated_client):
        """Should initialize usage_count to 0."""
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
        data = response.json()
        assert data["data"]["usage_count"] == 0


class TestSpecialCharactersAndEncoding:
    """Tests for special characters and encoding edge cases."""

    @pytest.mark.asyncio
    async def test_template_name_with_sql_injection_attempt(self, authenticated_client):
        """Should safely handle SQL injection attempts in name."""
        malicious_name = "'; DROP TABLE workflow_templates; --"
        response = await authenticated_client.post(
            "/templates/",
            json={
                "name": malicious_name,
                "description": "Test",
                "category": "automation",
                "workflow_data": {"nodes": []},
                "is_public": False,
            },
        )

        # Should treat as normal string, not execute
        assert response.status_code == 201

        # Verify it was stored as plain text, not executed
        template_id = response.json()["data"]["id"]
        get_response = await authenticated_client.get(f"/templates/{template_id}")

        # The dangerous string should be stored exactly as-is
        assert get_response.json()["data"]["name"] == malicious_name

        # Verify the templates table still exists (wasn't dropped!)
        list_response = await authenticated_client.get("/templates/")
        assert list_response.status_code == 200

    @pytest.mark.asyncio
    async def test_template_description_with_html_tags(self, authenticated_client):
        """Should safely store HTML/JavaScript as plain text."""
        malicious_html = "<script>alert('xss')</script>"

        # Create template with XSS attempt
        response = await authenticated_client.post(
            "/templates/",
            json={
                "name": "XSS Test",
                "description": malicious_html,
                "category": "automation",
                "workflow_data": {"nodes": []},
                "is_public": False,
            },
        )

        # Should treat as normal string, not execute
        assert response.status_code == 201

        # Verify it's stored exactly as plain text, not executed
        template_id = response.json()["data"]["id"]
        get_response = await authenticated_client.get(f"/templates/{template_id}")

        stored_description = get_response.json()["data"]["description"]
        assert stored_description == malicious_html

        # Verify the response is JSON (not HTML that could execute)
        assert get_response.headers["content-type"] == "application/json"

    @pytest.mark.asyncio
    async def test_create_template_with_special_characters(self, authenticated_client):
        """Should preserve special characters when creating template."""
        special_name = "Template!@#$%^&*()_+-=[]{}|;:,.<>?"

        # Create template with special characters
        response = await authenticated_client.post(
            "/templates/",
            json={
                "name": special_name,
                "description": "Test description",
                "category": "automation",
                "workflow_data": {"nodes": []},
                "is_public": False,
            },
        )

        # Creation should succeed
        assert response.status_code == 201

        # Verify special characters were preserved
        created_data = response.json()["data"]
        assert created_data["name"] == special_name

    @pytest.mark.asyncio
    async def test_template_with_unicode_characters(self, authenticated_client):
        """Should preserve Unicode characters in template fields."""
        unicode_name = "测试模板-テスト-टेम्पलेट-🚀"
        unicode_description = "Описание шаблона avec des caractères spéciaux"
        unicode_category = "自動化"

        response = await authenticated_client.post(
            "/templates/",
            json={
                "name": unicode_name,
                "description": unicode_description,
                "category": unicode_category,
                "workflow_data": {"nodes": []},
                "is_public": False,
            },
        )

        assert response.status_code == 201
        data = response.json()["data"]
        assert data["name"] == unicode_name
        assert data["description"] == unicode_description
        assert data["category"] == unicode_category

    @pytest.mark.asyncio
    async def test_template_with_newlines_and_tabs(self, authenticated_client):
        """Should preserve newlines and tabs in text fields."""
        description_with_formatting = (
            "Line 1\nLine 2\n\tTabbed line\n\n\nMultiple newlines"
        )

        response = await authenticated_client.post(
            "/templates/",
            json={
                "name": "Formatting Test",
                "description": description_with_formatting,
                "category": "automation",
                "workflow_data": {"nodes": []},
                "is_public": False,
            },
        )

        assert response.status_code == 201
        data = response.json()["data"]
        assert data["description"] == description_with_formatting

    @pytest.mark.asyncio
    async def test_workflow_data_with_special_json_values(self, authenticated_client):
        """Should handle special JSON values in workflow_data."""
        workflow_data = {
            "null_value": None,
            "boolean_true": True,
            "boolean_false": False,
            "number": 42,
            "float": 3.14159,
            "negative": -100,
            "string": "normal string",
            "empty_string": "",
            "empty_array": [],
            "empty_object": {},
            "nested": {
                "deep": {"deeper": {"deepest": "value"}},
                "array": [1, 2, 3, [4, 5]],
            },
        }

        response = await authenticated_client.post(
            "/templates/",
            json={
                "name": "Special JSON Test",
                "description": "Test",
                "category": "automation",
                "workflow_data": workflow_data,
                "is_public": False,
            },
        )

        assert response.status_code == 201
        data = response.json()["data"]
        assert data["workflow_data"] == workflow_data


class TestCategoryHandling:
    """Tests for template category functionality."""

    @pytest.mark.asyncio
    async def test_create_template_with_various_categories(self, authenticated_client):
        """Should accept various category values."""
        categories = [
            "automation",
            "data-processing",
            "integration",
            "notification",
            "general",
            "testing",
            "custom",
        ]

        for category in categories:
            response = await authenticated_client.post(
                "/templates/",
                json={
                    "name": f"Template {category}",
                    "description": "Test",
                    "category": category,
                    "workflow_data": {"nodes": []},
                    "is_public": False,
                },
            )

            assert response.status_code == 201
            data = response.json()["data"]
            assert data["category"] == category

    @pytest.mark.asyncio
    async def test_create_template_with_empty_category(self, authenticated_client):
        """Should accept empty category string."""
        response = await authenticated_client.post(
            "/templates/",
            json={
                "name": "Empty Category",
                "description": "Test",
                "category": "",
                "workflow_data": {"nodes": []},
                "is_public": False,
            },
        )

        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_default_category_is_general(self, authenticated_client):
        """Should use 'general' as default category."""
        response = await authenticated_client.post(
            "/templates/",
            json={
                "name": "Default Category Test",
                "description": "Test",
                # category omitted
                "workflow_data": {"nodes": []},
                "is_public": False,
            },
        )

        assert response.status_code == 201
        data = response.json()["data"]
        assert data["category"] == "general"
