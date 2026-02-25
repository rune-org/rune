import copy
from sqlmodel import select, delete
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import Workflow, WorkflowUser, WorkflowRole, WorkflowCredential
from src.core.exceptions import NotFound, Forbidden
from src.credentials.encryption import get_encryptor


class WorkflowService:
    """Database service for Workflow objects.

    Holds a DB session and exposes simple methods used by API
    routers: listing, retrieval, creation, updates, and deletion.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.encryptor = get_encryptor()

    async def list_for_user(self, user_id: int) -> list[tuple[Workflow, WorkflowRole]]:
        """Return workflows accessible to `user_id` with their role, newest first.

        Used for the `GET /workflows` endpoint.
        """
        # Select both the workflow and the user's role from the junction table
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

        First delete all related WorkflowUser entries, then delete the workflow itself.
        """
        stmt = delete(WorkflowUser).where(WorkflowUser.workflow_id == workflow.id)
        await self.db.exec(stmt)
        await self.db.commit()

        # Now delete the workflow itself
        await self.db.delete(workflow)
        await self.db.commit()

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
