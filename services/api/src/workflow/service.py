from sqlmodel import select, delete
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import Workflow, WorkflowUser, WorkflowRole
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
        # Join the workflows to the junction table and filter by the user_id
        statement = (
            select(Workflow)
            .join(WorkflowUser)
            .where(WorkflowUser.user_id == user_id)
            .order_by(Workflow.created_at.desc())
        )
        result = await self.db.exec(statement)
        return result.all()

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

        # Verify the user has any permission entry for the workflow.
        stmt = select(WorkflowUser).where(
            WorkflowUser.workflow_id == workflow_id,
            WorkflowUser.user_id == user_id,
        )
        res = await self.db.exec(stmt)
        if not res.first():
            raise Forbidden()

        return wf

    async def create(
        self, user_id: int, name: str, description: str, workflow_data: dict
    ) -> Workflow:
        """Create and persist a new Workflow owned by `user_id`.

        Commits the transaction and returns the refreshed model instance.
        """
        # Create the workflow record first, then add an OWNER entry in the workflow_users table
        wf = Workflow(
            name=name,
            description=description,
            workflow_data=workflow_data,
        )
        self.db.add(wf)
        # Flush to assign the workflow primary key without committing yet
        await self.db.flush()

        owner = WorkflowUser(
            workflow_id=wf.id,
            user_id=user_id,
            role=WorkflowRole.OWNER,
            granted_by=user_id,
        )
        self.db.add(owner)

        # Commit both records in a single transaction
        await self.db.commit()

        # This is cheaper than refreshing after each commit.
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
        """Hard-delete the given Workflow and commit the change.

        First delete all related WorkflowUser entries, then delete the workflow itself.
        """
        stmt = delete(WorkflowUser).where(WorkflowUser.workflow_id == workflow.id)
        await self.db.exec(stmt)
        await self.db.commit()

        # Now delete the workflow itself
        await self.db.delete(workflow)
        await self.db.commit()
