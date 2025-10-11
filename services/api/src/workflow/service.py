from typing import Any, cast
from sqlalchemy import desc
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import Workflow
from src.core.exceptions import NotFound, Forbidden


class WorkflowService:
    """Database service for Workflow objects.

    Holds a DB session and exposes simple methods used by API
    routers: listing, retrieval, creation, updates, and deletion.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_for_user(self, user_id: int) -> list[Workflow]:
        """Return workflows owned by `user_id`, newest first.

        Used for the `GET /workflows` endpoint.
        """
        statement = (
            select(Workflow)
            .where(Workflow.created_by == user_id)
            .order_by(desc(cast(Any, Workflow.created_at)))
        )
        result = await self.db.exec(statement)
        return list(result.all())

    async def get_by_id(self, workflow_id: int) -> Workflow | None:
        """Return a Workflow by primary key or None if not found."""
        return await self.db.get(Workflow, workflow_id)

    async def get_for_user(self, workflow_id: int, user_id: int) -> Workflow:
        """Fetch a workflow and enforce that `user_id` is the owner.

        Raises NotFound if the workflow doesn't exist, or Forbidden if the
        user is not the owner. This centralizes ownership checks for
        callers (routers) so they remain concise.
        """
        wf = await self.get_by_id(workflow_id)
        if not wf:
            raise NotFound(detail="Workflow not found")
        if wf.created_by != user_id:
            raise Forbidden()
        return wf

    async def create(
        self, user_id: int, name: str, description: str, workflow_data: dict
    ) -> Workflow:
        """Create and persist a new Workflow owned by `user_id`.

        Commits the transaction and returns the refreshed model instance.
        """
        wf = Workflow(
            name=name,
            description=description,
            workflow_data=workflow_data,
            created_by=user_id,
        )
        self.db.add(wf)
        await self.db.commit()
        await self.db.refresh(wf)
        return wf

    async def update_name(self, workflow: Workflow, name: str) -> Workflow:
        """Update only the workflow's name and persist the change.

        Caller is responsible for authorization. Returns the refreshed model.
        """
        workflow.name = name
        await self.db.commit()
        await self.db.refresh(workflow)
        return workflow

    async def update_status(self, workflow: Workflow, is_active: bool) -> Workflow:
        """Set workflow active/inactive and persist.

        This is intentionally simple — additional side-effects (e.g. scheduled
        jobs) should be implemented at a higher layer if needed.
        """
        workflow.is_active = is_active
        await self.db.commit()
        await self.db.refresh(workflow)
        return workflow

    async def delete(self, workflow: Workflow) -> None:
        """Hard-delete the given Workflow and commit the change."""
        await self.db.delete(workflow)
        await self.db.commit()
