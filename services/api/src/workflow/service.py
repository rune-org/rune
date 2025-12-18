import copy
from datetime import datetime
from sqlmodel import select, delete
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import (
    Workflow,
    WorkflowUser,
    WorkflowRole,
    WorkflowCredential,
    TriggerType,
    ScheduledWorkflow,
)
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

    async def list_for_user(
        self, user_id: int, include_schedule: bool = False
    ) -> list[Workflow]:
        """Return workflows owned by `user_id`, newest first.

        Args:
            user_id: The user ID to filter by
            include_schedule: If True, eagerly load schedule information via LEFT JOIN

        Used for the `GET /workflows` endpoint.
        """
        # Join the workflows to the junction table and filter by the user_id
        statement = (
            select(Workflow)
            .join(WorkflowUser)
            .where(WorkflowUser.user_id == user_id)
            .order_by(Workflow.created_at.desc())
        )

        # If include_schedule requested, add LEFT JOIN to get schedule info
        if include_schedule:
            # Use selectinload to eagerly load the schedule relationship
            # This prevents N+1 queries when accessing workflow.schedule
            statement = statement.options(selectinload(Workflow.schedule))

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

        Automatically detects trigger type from workflow_data and sets trigger_type.
        If trigger type is SCHEDULED, automatically creates the schedule.
        Commits the transaction and returns the refreshed model instance.
        """
        # Detect trigger type from workflow data
        trigger_type = self._detect_trigger_type(workflow_data)

        # Create the workflow record first, then add an OWNER entry in the workflow_users table
        wf = Workflow(
            name=name,
            description=description,
            workflow_data=workflow_data,
            trigger_type=trigger_type,
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

        # If trigger type is SCHEDULED, create the schedule
        if trigger_type == TriggerType.SCHEDULED:
            schedule_config = self._extract_schedule_config(workflow_data)
            if schedule_config:
                start_at = schedule_config.get("start_at") or datetime.now()
                interval_seconds = schedule_config["interval_seconds"]
                is_active = schedule_config.get("is_active", True)

                next_run_at = start_at
                if isinstance(start_at, str):
                    parsed = datetime.fromisoformat(start_at.replace("Z", "+00:00"))
                    start_at = parsed.replace(tzinfo=None)
                    next_run_at = start_at
                elif isinstance(start_at, datetime):
                    # Remove timezone info if present
                    start_at = start_at.replace(tzinfo=None)
                    next_run_at = start_at

                schedule = ScheduledWorkflow(
                    workflow_id=wf.id,
                    interval_seconds=interval_seconds,
                    start_at=start_at,
                    next_run_at=next_run_at,
                    is_active=is_active,
                )
                self.db.add(schedule)

        # Commit all records in a single transaction
        await self.db.commit()

        # Refresh to load relationships
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

    async def update_workflow_data(
        self, workflow: Workflow, workflow_data: dict
    ) -> Workflow:
        """Update the workflow's workflow_data field and persist the change.

        Automatically detects and updates trigger_type based on workflow_data.
        Also manages schedule creation/update/deletion based on trigger type changes.
        Caller is responsible for authorization. Returns the refreshed model.
        """
        # Detect trigger type from new workflow data
        new_trigger_type = self._detect_trigger_type(workflow_data)

        # Get existing schedule if any
        stmt = select(ScheduledWorkflow).where(
            ScheduledWorkflow.workflow_id == workflow.id
        )
        result = await self.db.exec(stmt)
        existing_schedule = result.first()

        # Update workflow data and trigger type
        workflow.workflow_data = workflow_data
        workflow.trigger_type = new_trigger_type

        # Handle schedule changes based on trigger type
        if new_trigger_type == TriggerType.SCHEDULED:
            schedule_config = self._extract_schedule_config(workflow_data)
            if schedule_config:
                if existing_schedule:
                    # Update existing schedule preserving continuity
                    old_interval = existing_schedule.interval_seconds
                    existing_schedule.interval_seconds = schedule_config["interval_seconds"]
                    existing_schedule.is_active = schedule_config.get("is_active", True)
                    
                    # Recalculate next_run if interval changed
                    if old_interval != existing_schedule.interval_seconds:
                        existing_schedule.next_run_at = self._calculate_next_run_helper(
                            datetime.now(), 
                            existing_schedule.interval_seconds,
                            existing_schedule.start_at,
                            existing_schedule.last_run_at
                        )
                    self.db.add(existing_schedule)
                else:
                    # Create new schedule
                    start_at = schedule_config.get("start_at") or datetime.now()
                    interval_seconds = schedule_config["interval_seconds"]
                    is_active = schedule_config.get("is_active", True)

                    # Ensure timezone-naive datetime
                    if isinstance(start_at, str):
                        parsed = datetime.fromisoformat(start_at.replace("Z", "+00:00"))
                        start_at = parsed.replace(tzinfo=None)
                    elif isinstance(start_at, datetime) and start_at.tzinfo is not None:
                        start_at = start_at.replace(tzinfo=None)

                    # Calculate next_run_at using smart logic
                    next_run_at = self._calculate_next_run_helper(
                        datetime.now(), interval_seconds, start_at, last_run_at=None
                    )

                    schedule = ScheduledWorkflow(
                        workflow_id=workflow.id,
                        interval_seconds=interval_seconds,
                        start_at=start_at,
                        next_run_at=next_run_at,
                        is_active=is_active,
                    )
                    self.db.add(schedule)
        else:
            # If trigger type is not SCHEDULED and there's an existing schedule, delete it
            if existing_schedule:
                await self.db.delete(existing_schedule)

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

    def _detect_trigger_type(self, workflow_data: dict) -> TriggerType:
        """Detect the trigger type from workflow data.

        Analyzes the workflow nodes to determine if it has scheduled or webhook triggers.
        Returns TriggerType.MANUAL for manual-only workflows.

        Args:
            workflow_data: The workflow definition containing nodes and edges

        Returns:
            TriggerType.SCHEDULED if workflow has schedule configuration
            TriggerType.WEBHOOK if workflow has webhook configuration
            TriggerType.MANUAL if workflow is manual-only
        """
        nodes = workflow_data.get("nodes", [])

        for node in nodes:
            node_type = node.get("type", "")
            
            # Check for ScheduleTrigger node type (DSL format)
            if node_type == "ScheduleTrigger" and node.get("trigger") is True:
                parameters = node.get("parameters", {})
                if "interval_seconds" in parameters:
                    return TriggerType.SCHEDULED
            
            # Check for WebhookTrigger node type (DSL format)
            if node_type == "WebhookTrigger" and node.get("trigger") is True:
                return TriggerType.WEBHOOK

        # No automatic trigger found - default to manual
        return TriggerType.MANUAL

    def _extract_schedule_config(self, workflow_data: dict) -> dict | None:
        """Extract schedule configuration from workflow data.

        Args:
            workflow_data: The workflow definition containing nodes

        Returns:
            Dictionary with schedule configuration or None if not found
            Expected format: {"interval_seconds": int, "start_at": datetime, "is_active": bool}
        """
        nodes = workflow_data.get("nodes", [])

        for node in nodes:
            node_type = node.get("type", "")
            
            # Check for ScheduleTrigger node type (DSL format)
            if node_type == "ScheduleTrigger" and node.get("trigger") is True:
                parameters = node.get("parameters", {})
                
                if "interval_seconds" in parameters:
                    # Extract and validate configuration
                    config = {
                        "interval_seconds": parameters["interval_seconds"],
                        "is_active": parameters.get("is_active", True),
                    }

                    # Parse start_at if provided
                    if "start_at" in parameters:
                        start_at = parameters["start_at"]
                        if isinstance(start_at, str):
                            parsed = datetime.fromisoformat(
                                start_at.replace("Z", "+00:00")
                            )
                            # Remove timezone info for PostgreSQL (store as naive UTC)
                            config["start_at"] = parsed.replace(tzinfo=None)
                        elif isinstance(start_at, datetime):
                            # Remove timezone info if present
                            config["start_at"] = start_at.replace(tzinfo=None)

                    return config

        return None

    def _calculate_next_run_helper(
        self, from_time: datetime, interval_seconds: int, 
        start_at: datetime | None = None, last_run_at: datetime | None = None
    ) -> datetime:
        """Helper to calculate next run time (matches ScheduledWorkflowService logic)."""
        from datetime import timedelta
        
        # First run (never executed before)
        if last_run_at is None and start_at:
            # If start_at is in the past, run immediately
            if start_at < from_time:
                return from_time
            # If start_at is in the future, wait for it
            return start_at
        
        # Subsequent runs: add interval from current time
        return from_time + timedelta(seconds=interval_seconds)
