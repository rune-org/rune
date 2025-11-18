from typing import Optional
from sqlmodel import select, update, or_
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import WorkflowTemplate
from src.core.exceptions import NotFound, Forbidden
from src.templates.schemas import TemplateCreate


class TemplateService:
    """Service for managing workflow templates."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_all_accessible_templates(
        self, user_id: int
    ) -> list[WorkflowTemplate]:
        """Get all templates accessible to a user (public + their own)."""
        stmt = select(WorkflowTemplate).where(
            or_(WorkflowTemplate.is_public, WorkflowTemplate.created_by == user_id)
        )
        result = await self.db.exec(stmt)
        return result.all()

    async def get_template(
        self, template_id: int, user_id: Optional[int] = None
    ) -> WorkflowTemplate:
        """Get a specific template by ID."""
        stmt = select(WorkflowTemplate).where(WorkflowTemplate.id == template_id)
        result = await self.db.exec(stmt)
        template = result.one_or_none()

        if not template:
            raise NotFound(f"Template with id {template_id} not found")

        # Check access permissions
        if not template.is_public and (
            user_id is None or template.created_by != user_id
        ):
            raise Forbidden("Access denied to this template")

        return template

    async def create_template(
        self, user_id: int, template_data: TemplateCreate
    ) -> WorkflowTemplate:
        """Create a new template."""
        template = WorkflowTemplate(
            name=template_data.name,
            description=template_data.description,
            category=template_data.category,
            workflow_data=template_data.workflow_data,
            is_public=template_data.is_public,
            created_by=user_id,
        )

        self.db.add(template)
        await self.db.commit()
        await self.db.refresh(template)
        return template

    async def delete_template(self, template_id: int, user_id: int) -> None:
        """Delete a template."""
        template = await self.get_template(template_id, user_id)

        # Only the creator can delete their template
        if template.created_by != user_id:
            raise Forbidden("Only the template creator can delete it")

        await self.db.delete(template)
        await self.db.commit()

    async def increment_usage_count(self, template_id: int) -> None:
        """Increment the usage count for a template."""
        stmt = (
            update(WorkflowTemplate)
            .where(WorkflowTemplate.id == template_id)
            .values(usage_count=WorkflowTemplate.usage_count + 1)
        )

        # Execute the UPDATE and commit. This delegates the increment to the database so concurrent workers won't overwrite each other's increments.
        await self.db.exec(stmt)
        await self.db.commit()
