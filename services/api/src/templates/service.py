from typing import Optional

from sqlalchemy import String, case, func
from sqlmodel import or_, select, update
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.exceptions import Forbidden, NotFound
from src.db.models import User, UserRole, WorkflowTemplate
from src.templates.categories import TemplateScope, TemplateSort, TemplateSource
from src.templates.schemas import TemplateCreate


class TemplateService:
    """Service for managing workflow templates."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_all_accessible_templates(
        self,
        user_id: int,
        *,
        category: Optional[str] = None,
        source: Optional[str] = None,
        scope: Optional[TemplateScope] = None,
        tags: Optional[list[str]] = None,
        search: Optional[str] = None,
        sort: TemplateSort = TemplateSort.FEATURED,
    ) -> list[WorkflowTemplate]:
        """Get templates accessible to a user (public + their own) with filters.

        ``scope`` is the user-facing bucket (``official``/``community``/
        ``personal``) and is the preferred filter for the gallery UI.
        ``source`` remains exposed for lower-level filtering.

        ``category`` is matched as a plain string (not the strict enum) so
        callers can still filter on legacy values stored in the DB. ``tags``
        uses Postgres' ``?|`` operator - a row matches if **any** of its tags
        is in the requested list. ``search`` is a case-insensitive substring
        match against ``name``, ``description``, and ``tags``.
        """
        stmt = select(WorkflowTemplate).where(
            or_(WorkflowTemplate.is_public, WorkflowTemplate.created_by == user_id)
        )

        if scope == TemplateScope.OFFICIAL:
            stmt = stmt.where(WorkflowTemplate.source == "official")
        elif scope == TemplateScope.COMMUNITY:
            stmt = stmt.where(
                WorkflowTemplate.source == "user",
                WorkflowTemplate.is_public.is_(True),
            )
        elif scope == TemplateScope.PERSONAL:
            # Personal = mine and not public. The outer visibility filter
            # already restricts non-public rows to the caller's own.
            stmt = stmt.where(
                WorkflowTemplate.source == "user",
                WorkflowTemplate.is_public.is_(False),
                WorkflowTemplate.created_by == user_id,
            )

        if category:
            stmt = stmt.where(WorkflowTemplate.category == category)
        if source:
            stmt = stmt.where(WorkflowTemplate.source == source)
        if tags:
            stmt = stmt.where(func.jsonb_exists_any(WorkflowTemplate.tags, tags))
        if search:
            term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    WorkflowTemplate.name.ilike(term),
                    WorkflowTemplate.description.ilike(term),
                    WorkflowTemplate.tags.cast(String).ilike(term),
                )
            )

        if sort == TemplateSort.FEATURED:
            stmt = stmt.order_by(
                case((WorkflowTemplate.source == "official", 0), else_=1),
                WorkflowTemplate.usage_count.desc(),
                WorkflowTemplate.name.asc(),
            )
        elif sort == TemplateSort.POPULAR:
            stmt = stmt.order_by(
                WorkflowTemplate.usage_count.desc(), WorkflowTemplate.name.asc()
            )
        elif sort == TemplateSort.NEWEST:
            stmt = stmt.order_by(WorkflowTemplate.created_at.desc())
        elif sort == TemplateSort.ALPHABETICAL:
            stmt = stmt.order_by(WorkflowTemplate.name.asc())

        result = await self.db.exec(stmt)
        return result.all()

    async def count_templates_by_category(
        self, user_id: int, *, scope: Optional[TemplateScope] = None
    ) -> dict[str, int]:
        """Group accessible templates by category and return ``{category: count}``.

        Scope-aware so the gallery chips can reflect what the active tab will
        show. Legacy category values (free-form strings stored before the
        ``TemplateCategory`` enum existed) are included; the router decides
        which to surface to the UI.
        """
        stmt = (
            select(WorkflowTemplate.category, func.count())
            .where(
                or_(
                    WorkflowTemplate.is_public,
                    WorkflowTemplate.created_by == user_id,
                )
            )
            .group_by(WorkflowTemplate.category)
        )

        if scope == TemplateScope.OFFICIAL:
            stmt = stmt.where(WorkflowTemplate.source == "official")
        elif scope == TemplateScope.COMMUNITY:
            stmt = stmt.where(
                WorkflowTemplate.source == "user",
                WorkflowTemplate.is_public.is_(True),
            )
        elif scope == TemplateScope.PERSONAL:
            stmt = stmt.where(
                WorkflowTemplate.source == "user",
                WorkflowTemplate.is_public.is_(False),
                WorkflowTemplate.created_by == user_id,
            )

        result = await self.db.exec(stmt)
        return {row[0]: row[1] for row in result.all()}

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
        """Create a new template.

        Structural validation of ``workflow_data`` is handled upstream by the
        ``WorkflowGraph`` Pydantic model on ``TemplateCreate``.
        """
        template = WorkflowTemplate(
            name=template_data.name,
            description=template_data.description,
            category=template_data.category,
            workflow_data=template_data.workflow_data.model_dump(
                exclude_none=True, mode="json"
            ),
            is_public=template_data.is_public,
            icon=template_data.icon,
            tags=template_data.tags,
            source="user",
            created_by=user_id,
        )

        self.db.add(template)
        await self.db.commit()
        await self.db.refresh(template)
        return template

    async def delete_template(self, template_id: int, user: User) -> None:
        """Delete a user-created template.

        Allowed for the template's creator or an admin. Official templates
        are managed by the bundle seeder and cannot be deleted.
        """
        stmt = select(WorkflowTemplate).where(WorkflowTemplate.id == template_id)
        template = (await self.db.exec(stmt)).one_or_none()

        if not template:
            raise NotFound(f"Template with id {template_id} not found")
        if template.source == TemplateSource.OFFICIAL:
            raise Forbidden("Official templates cannot be deleted")

        is_admin = user.role == UserRole.ADMIN
        is_author = template.created_by is not None and template.created_by == user.id
        if not (is_admin or is_author):
            raise Forbidden("Only the template creator or an admin can delete it")

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
