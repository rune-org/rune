"""Service layer tests for template business logic — access control, persistence, concurrency."""

import pytest
from sqlmodel import select

from src.templates.schemas import TemplateCreate
from src.core.exceptions import NotFound, Forbidden
from src.db.models import WorkflowTemplate


# ============================================================================
# ACCESS CONTROL TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_list_returns_public_templates_for_any_user(
    template_service, test_user, sample_public_template
):
    """Should return public templates regardless of ownership."""
    templates = await template_service.list_all_accessible_templates(test_user.id)
    assert sample_public_template.id in [t.id for t in templates]


@pytest.mark.asyncio
async def test_list_returns_users_own_private_templates(
    template_service, test_user, sample_private_template
):
    """Should return user's own private templates."""
    templates = await template_service.list_all_accessible_templates(test_user.id)
    assert sample_private_template.id in [t.id for t in templates]


@pytest.mark.asyncio
async def test_list_excludes_other_users_private_templates(
    template_service, test_user, other_user_private_template
):
    """Should exclude other users' private templates from list."""
    templates = await template_service.list_all_accessible_templates(test_user.id)
    assert other_user_private_template.id not in [t.id for t in templates]


@pytest.mark.asyncio
async def test_get_public_template_accessible_by_any_user(
    template_service, test_user, sample_public_template
):
    """Should allow any user to get public template."""
    template = await template_service.get_template(
        sample_public_template.id, test_user.id
    )
    assert template.id == sample_public_template.id


@pytest.mark.asyncio
async def test_get_own_private_template_accessible(
    template_service, test_user, sample_private_template
):
    """Should allow user to get their own private template."""
    template = await template_service.get_template(
        sample_private_template.id, test_user.id
    )
    assert template.id == sample_private_template.id


@pytest.mark.asyncio
async def test_get_other_users_private_template_raises_forbidden(
    template_service, test_user, other_user_private_template
):
    """Should deny access to other users' private templates."""
    with pytest.raises(Forbidden):
        await template_service.get_template(
            other_user_private_template.id, test_user.id
        )


@pytest.mark.asyncio
async def test_get_public_template_without_user_id(
    template_service, sample_public_template
):
    """Should allow unauthenticated access to public templates."""
    template = await template_service.get_template(
        sample_public_template.id, user_id=None
    )
    assert template.id == sample_public_template.id


@pytest.mark.asyncio
async def test_get_private_template_without_user_id_raises_forbidden(
    template_service, sample_private_template
):
    """Should deny unauthenticated access to private templates."""
    with pytest.raises(Forbidden):
        await template_service.get_template(sample_private_template.id, user_id=None)


@pytest.mark.asyncio
async def test_delete_own_template_allowed(
    template_service, test_user, sample_private_template, test_db
):
    """Should allow user to delete their own template."""
    template_id = sample_private_template.id
    await template_service.delete_template(template_id, test_user.id)

    # Verify deleted
    statement = select(WorkflowTemplate).where(WorkflowTemplate.id == template_id)
    result = await test_db.exec(statement)
    assert result.first() is None


@pytest.mark.asyncio
async def test_delete_other_users_template_raises_forbidden(
    template_service, test_user, other_user_private_template
):
    """Should deny deletion of other users' templates."""
    with pytest.raises(Forbidden):
        await template_service.delete_template(
            other_user_private_template.id, test_user.id
        )


# ============================================================================
# BUSINESS LOGIC TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_create_template_sets_created_by(template_service, test_user, test_db):
    """Should associate created template with creator."""
    template_data = TemplateCreate(
        name="User Template",
        description="Test",
        category="automation",
        workflow_data={"nodes": []},
        is_public=False,
    )

    template = await template_service.create_template(test_user.id, template_data)
    assert template.created_by == test_user.id


@pytest.mark.asyncio
async def test_create_template_initializes_usage_count_to_zero(
    template_service, test_user
):
    """Should initialize usage_count to 0."""
    template_data = TemplateCreate(
        name="New Template",
        description="Test",
        category="automation",
        workflow_data={"nodes": []},
        is_public=False,
    )

    template = await template_service.create_template(test_user.id, template_data)
    assert template.usage_count == 0


@pytest.mark.asyncio
async def test_create_template_respects_is_public_flag(template_service, test_user):
    """Should set is_public as provided."""
    private_data = TemplateCreate(
        name="Private",
        workflow_data={"nodes": []},
        is_public=False,
    )
    private_template = await template_service.create_template(
        test_user.id, private_data
    )
    assert private_template.is_public is False

    public_data = TemplateCreate(
        name="Public",
        workflow_data={"nodes": []},
        is_public=True,
    )
    public_template = await template_service.create_template(test_user.id, public_data)
    assert public_template.is_public is True


@pytest.mark.asyncio
async def test_create_template_persists_to_database(
    template_service, test_user, test_db
):
    """Should persist created template to database."""
    template_data = TemplateCreate(
        name="Persisted",
        description="Test",
        category="automation",
        workflow_data={"nodes": []},
        is_public=False,
    )

    template = await template_service.create_template(test_user.id, template_data)

    # Verify in database
    statement = select(WorkflowTemplate).where(WorkflowTemplate.id == template.id)
    result = await test_db.exec(statement)
    db_template = result.first()

    assert db_template is not None
    assert db_template.name == "Persisted"
    assert db_template.created_by == test_user.id


@pytest.mark.asyncio
async def test_get_nonexistent_template_raises_not_found(template_service, test_user):
    """Should raise NotFound for non-existent template."""
    with pytest.raises(NotFound):
        await template_service.get_template(99999, test_user.id)


@pytest.mark.asyncio
async def test_delete_nonexistent_template_raises_not_found(
    template_service, test_user
):
    """Should raise NotFound when deleting non-existent template."""
    with pytest.raises(NotFound):
        await template_service.delete_template(99999, test_user.id)


# ============================================================================
# USAGE COUNT TESTS
# ============================================================================


@pytest.mark.asyncio
async def test_increment_usage_count_increments_correctly(
    template_service, sample_public_template, test_db
):
    """Should increment usage count in database."""
    initial_count = sample_public_template.usage_count
    template_id = sample_public_template.id

    await template_service.increment_usage_count(template_id)

    # Verify incremented
    statement = select(WorkflowTemplate).where(WorkflowTemplate.id == template_id)
    result = await test_db.exec(statement)
    template = result.first()
    assert template.usage_count == initial_count + 1


@pytest.mark.asyncio
async def test_increment_usage_count_multiple_times(
    template_service, sample_public_template, test_db
):
    """Should handle multiple increments correctly."""
    initial_count = sample_public_template.usage_count
    template_id = sample_public_template.id

    for _ in range(5):
        await template_service.increment_usage_count(template_id)

    statement = select(WorkflowTemplate).where(WorkflowTemplate.id == template_id)
    result = await test_db.exec(statement)
    template = result.first()
    assert template.usage_count == initial_count + 5


@pytest.mark.asyncio
async def test_increment_usage_count_independent_per_template(
    template_service, sample_public_template, sample_private_template, test_db
):
    """Should increment usage count independently for each template."""
    template1_id = sample_public_template.id
    template2_id = sample_private_template.id
    count1_initial = sample_public_template.usage_count
    count2_initial = sample_private_template.usage_count

    # Increment template1 twice
    await template_service.increment_usage_count(template1_id)
    await template_service.increment_usage_count(template1_id)

    # Increment template2 once
    await template_service.increment_usage_count(template2_id)

    # Verify counts
    stmt1 = select(WorkflowTemplate).where(WorkflowTemplate.id == template1_id)
    result1 = await test_db.exec(stmt1)
    template1 = result1.first()

    stmt2 = select(WorkflowTemplate).where(WorkflowTemplate.id == template2_id)
    result2 = await test_db.exec(stmt2)
    template2 = result2.first()

    assert template1.usage_count == count1_initial + 2
    assert template2.usage_count == count2_initial + 1
