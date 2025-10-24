from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import WorkflowTemplate
from src.core.exceptions import NotFound, Forbidden
from src.templates.schemas import TemplateCreate


class TemplateService:
    """Service for managing workflow templates."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_all_accessible_templates(
        self, user_id: int
    ) -> List[WorkflowTemplate]:
        """Get all templates accessible to a user (public + their own)."""
        stmt = select(WorkflowTemplate).where(
            (WorkflowTemplate.is_public)
            | (WorkflowTemplate.created_by == user_id)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_template(
        self, template_id: int, user_id: Optional[int] = None
    ) -> WorkflowTemplate:
        """Get a specific template by ID."""
        stmt = select(WorkflowTemplate).where(WorkflowTemplate.id == template_id)
        result = await self.db.execute(stmt)
        template = result.scalar_one_or_none()

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
            usage_count=0,
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
        stmt = select(WorkflowTemplate).where(WorkflowTemplate.id == template_id)
        result = await self.db.execute(stmt)
        template = result.scalar_one_or_none()

        if template:
            template.usage_count += 1
            await self.db.commit()
            await self.db.refresh(template)

    @staticmethod
    def _extract_node_types(
        workflow_data: dict
    ) -> tuple[Optional[str], Optional[str]]:
        """Extract the first and last node types from workflow data for display."""
        nodes = workflow_data.get("nodes", [])
        if not nodes:
            return None, None

        # Find trigger node (first) and last node
        trigger_node = None
        last_node = None

        for node in nodes:
            if node.get("trigger", False):
                trigger_node = node.get("type")
            last_node = node.get("type")  # Keep updating to get the last one

        return trigger_node, last_node
