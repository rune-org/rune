import copy
import uuid

from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.exceptions import Forbidden, NotFound
from src.credentials.encryption import get_encryptor
from src.db.models import (
    Execution,
    ExecutionStatus,
    Workflow,
    WorkflowCredential,
    WorkflowRole,
    WorkflowUser,
)


class WorkflowService:
    """Database service for Workflow objects.

    Holds a DB session and exposes simple methods used by API
    routers: listing, retrieval, creation, updates, and deletion.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.encryptor = get_encryptor()

    async def list_for_user(self, user_id: int) -> list[tuple[Workflow, WorkflowRole]]:
        """Return workflows owned by `user_id`, newest first.

        Used for the `GET /workflows` endpoint.
        """
        # Join the workflows to the junction table and filter by the user_id
        statement = (
            select(Workflow, WorkflowUser.role)
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

    async def update_workflow_data(
        self, workflow: Workflow, workflow_data: dict
    ) -> Workflow:
        """Update the workflow's workflow_data field and persist the change.

        Caller is responsible for authorization. Returns the refreshed model.
        """
        workflow.workflow_data = workflow_data
        await self.db.commit()
        await self.db.refresh(workflow)
        return workflow

    async def delete(self, workflow: Workflow) -> None:
        """Hard-delete the given Workflow and commit the change.

        Delete related executions and access rows first, then delete the workflow.
        """
        workflow_id = workflow.id
        if workflow_id is None:
            raise NotFound(detail="Workflow not found")

        stmt = delete(Execution).where(Execution.__table__.c.workflow_id == workflow_id)
        await self.db.exec(stmt)

        stmt = delete(WorkflowUser).where(
            WorkflowUser.__table__.c.workflow_id == workflow_id
        )
        await self.db.exec(stmt)

        await self.db.delete(workflow)
        await self.db.commit()

    # ------------------------------------------------------------------
    # Bulk helpers
    # ------------------------------------------------------------------

    async def bulk_fetch_with_roles(
        self, user_id: int, workflow_ids: list[int]
    ) -> dict[int, tuple[Workflow, WorkflowRole | None]]:
        """Fetch multiple workflows and the requesting user's role on each.

        Uses two efficient bulk queries instead of N individual lookups.
        Keys are only present for workflow IDs that actually exist in the
        database.  The role value is ``None`` when the user has no
        ``WorkflowUser`` entry (i.e. no access at all).
        """
        wf_stmt = select(Workflow).where(Workflow.id.in_(workflow_ids))
        wf_result = await self.db.exec(wf_stmt)
        workflows: dict[int, Workflow] = {wf.id: wf for wf in wf_result.all()}

        if not workflows:
            return {}

        role_stmt = select(WorkflowUser.workflow_id, WorkflowUser.role).where(
            WorkflowUser.user_id == user_id,
            WorkflowUser.workflow_id.in_(list(workflows.keys())),
        )
        role_result = await self.db.exec(role_stmt)
        roles: dict[int, WorkflowRole] = {
            wf_id: role for wf_id, role in role_result.all()
        }

        return {wf_id: (wf, roles.get(wf_id)) for wf_id, wf in workflows.items()}

    async def bulk_delete_many(self, workflows: list[Workflow]) -> None:
        """Delete multiple workflows in a single database transaction."""
        if not workflows:
            return

        workflow_ids = [wf.id for wf in workflows]

        await self.db.exec(
            delete(Execution).where(Execution.__table__.c.workflow_id.in_(workflow_ids))
        )
        await self.db.exec(
            delete(WorkflowUser).where(
                WorkflowUser.__table__.c.workflow_id.in_(workflow_ids)
            )
        )
        for wf in workflows:
            await self.db.delete(wf)

        await self.db.commit()

    async def bulk_set_status(self, workflows: list[Workflow], is_active: bool) -> None:
        """Set ``is_active`` on many workflows in one commit."""
        if not workflows:
            return

        for wf in workflows:
            wf.is_active = is_active

        await self.db.commit()

    async def queue_workflow_execution(
        self,
        workflow: Workflow,
        user_id: int,
        queue_service,
        token_service,
    ) -> str:
        """Queue a workflow for execution and return the execution_id.

        Handles:
        - Resolving credentials in workflow data
        - Creating execution record in database
        - Publishing execution token for real-time updates
        - Publishing workflow run message to RabbitMQ

        Args:
            workflow: The workflow to execute
            user_id: ID of the user triggering execution
            queue_service: WorkflowQueueService for publishing run messages
            token_service: ExecutionTokenService for publishing tokens

        Returns:
            execution_id (UUID string) for tracking

        Raises:
            ValueError: If workflow structure is invalid (missing trigger, etc.)
        """
        # Resolve credentials for all nodes in the workflow
        resolved_workflow_data = await self.resolve_workflow_credentials(
            workflow.workflow_data
        )

        # Generate a unique execution ID
        execution_id = str(uuid.uuid4())

        # Create execution record
        execution = Execution(
            id=execution_id,
            workflow_id=workflow.id,
            status=ExecutionStatus.PENDING,
        )
        self.db.add(execution)
        await self.db.commit()

        # Publish execution token for RTES authentication (with specific execution_id)
        await token_service.publish_execution_token(
            workflow_id=workflow.id,
            user_id=user_id,
            execution_id=execution_id,
        )

        # Publish workflow run message to queue with resolved credentials
        # This may raise ValueError if workflow structure is invalid
        await queue_service.publish_workflow_run(
            workflow_id=workflow.id,
            execution_id=execution_id,
            workflow_data=resolved_workflow_data,
        )

        return execution_id

    async def resolve_workflow_credentials(self, workflow_data: dict) -> dict:
        """
        Resolve credentials for all nodes in the workflow.

        Iterates through all nodes in the workflow_data, finds nodes with credential
        references, fetches the actual credential from the database, decrypts it,
        and embeds the resolved values in place.

        Args:
            workflow_data: The workflow definition containing nodes and edges
            user_id: ID of the user requesting the workflow run

        Returns:
            Updated workflow_data with resolved credentials embedded in nodes

        Raises:
            NotFound: If a referenced credential doesn't exist
            Forbidden: If user doesn't have access to a credential
        """
        # Create a deep copy to avoid mutating the original

        resolved_data = copy.deepcopy(workflow_data)

        # Get all nodes from the workflow
        nodes = resolved_data.get("nodes", [])

        for node in nodes:
            # Check if this node has a credentials reference
            if "credentials" in node and isinstance(node["credentials"], dict):
                cred_ref = node["credentials"]

                # If it has an id field, it's a reference that needs resolving
                if "id" in cred_ref:
                    credential_id = cred_ref["id"]

                    # Convert string ID to int if needed
                    if isinstance(credential_id, str):
                        credential_id = int(credential_id)

                    # Fetch the credential from database
                    credential: WorkflowCredential | None = await self.db.get(
                        WorkflowCredential, credential_id
                    )

                    if not credential:
                        raise NotFound(
                            detail=f"Credential with ID {credential_id} not found"
                        )

                    # Decrypt the credential data
                    decrypted_data = self.encryptor.decrypt_credential_data(
                        credential.credential_data
                    )

                    # Replace the credentials reference with resolved values
                    node["credentials"] = {
                        "id": str(credential.id),  # Convert to string for Go worker
                        "name": credential.name,
                        "type": credential.credential_type.value,
                        "values": decrypted_data,
                    }

        return resolved_data
