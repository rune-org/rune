import copy
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import selectinload
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.exceptions import Forbidden, NotFound
from src.credentials.encryption import get_encryptor
from src.db.models import (
    ScheduledWorkflow,
    TriggerType,
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

    async def list_for_user(
        self, user_id: int, include_schedule: bool = False
    ) -> list[tuple[Workflow, WorkflowRole]]:
        """Return workflows for `user_id`, newest first.

        Args:
            user_id: The user ID to filter by
            include_schedule: If True, eagerly load schedule information
        """
        statement = (
            select(Workflow, WorkflowUser.role)
            .join(WorkflowUser)
            .where(WorkflowUser.user_id == user_id)
            .order_by(Workflow.created_at.desc())
        )

        if include_schedule:
            statement = statement.options(selectinload(Workflow.schedule))

        result = await self.db.exec(statement)
        return result.all()

    async def get_by_id(self, workflow_id: int) -> Workflow | None:
        """Return a Workflow by primary key or None if not found."""
        return await self.db.get(Workflow, workflow_id)

    async def get_for_user(self, workflow_id: int, user_id: int) -> Workflow:
        """Fetch a workflow and enforce that `user_id` has access.

        Raises NotFound if the workflow doesn't exist, or Forbidden if the
        user has no permission entry.
        """
        wf = await self.get_by_id(workflow_id)
        if not wf:
            raise NotFound(detail="Workflow not found")

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

        Automatically detects trigger type from workflow_data.
        If scheduled, creates the ScheduledWorkflow record.
        """
        trigger_type = self._detect_trigger_type(workflow_data)

        wf = Workflow(
            name=name,
            description=description,
            workflow_data=workflow_data,
            trigger_type=trigger_type,
        )
        self.db.add(wf)
        await self.db.flush()

        owner = WorkflowUser(
            workflow_id=wf.id,
            user_id=user_id,
            role=WorkflowRole.OWNER,
            granted_by=user_id,
        )
        self.db.add(owner)

        if trigger_type == TriggerType.SCHEDULED:
            schedule_config = self.extract_schedule_config(workflow_data)
            if schedule_config:
                start_at = self._normalize_datetime(
                    schedule_config.get("start_at") or datetime.now()
                )
                schedule = ScheduledWorkflow(
                    workflow_id=wf.id,
                    interval_seconds=schedule_config["interval_seconds"],
                    start_at=start_at,
                    next_run_at=start_at,
                    is_active=schedule_config.get("is_active", True),
                )
                self.db.add(schedule)

        await self.db.commit()
        await self.db.refresh(wf)
        return wf

    async def update_name(self, workflow: Workflow, name: str) -> Workflow:
        """Update only the workflow's name and persist the change."""
        workflow.name = name
        await self.db.commit()
        await self.db.refresh(workflow)
        return workflow

    async def update_workflow_data(
        self, workflow: Workflow, workflow_data: dict
    ) -> Workflow:
        """Update workflow data and auto-manage trigger type and schedule."""
        new_trigger_type = self._detect_trigger_type(workflow_data)

        # Get existing schedule if any
        stmt = select(ScheduledWorkflow).where(
            ScheduledWorkflow.workflow_id == workflow.id
        )
        result = await self.db.exec(stmt)
        existing_schedule = result.first()

        workflow.workflow_data = workflow_data
        workflow.trigger_type = new_trigger_type

        if new_trigger_type == TriggerType.SCHEDULED:
            schedule_config = self.extract_schedule_config(workflow_data)
            if schedule_config:
                if existing_schedule:
                    old_interval = existing_schedule.interval_seconds
                    old_start_at = existing_schedule.start_at
                    new_start_at = schedule_config.get("start_at", old_start_at)
                    existing_schedule.interval_seconds = schedule_config[
                        "interval_seconds"
                    ]
                    existing_schedule.start_at = new_start_at

                    if "is_active" in schedule_config:
                        existing_schedule.is_active = schedule_config["is_active"]

                    if (
                        old_interval != existing_schedule.interval_seconds
                        or old_start_at != new_start_at
                    ):
                        existing_schedule.next_run_at = self._calculate_next_run(
                            datetime.now(),
                            existing_schedule.interval_seconds,
                            new_start_at,
                        )
                    self.db.add(existing_schedule)
                else:
                    start_at = self._normalize_datetime(
                        schedule_config.get("start_at") or datetime.now()
                    )
                    next_run_at = self._calculate_next_run(
                        datetime.now(),
                        schedule_config["interval_seconds"],
                        start_at,
                    )
                    schedule = ScheduledWorkflow(
                        workflow_id=workflow.id,
                        interval_seconds=schedule_config["interval_seconds"],
                        start_at=start_at,
                        next_run_at=next_run_at,
                        is_active=schedule_config.get("is_active", True),
                    )
                    self.db.add(schedule)
        elif existing_schedule:
            await self.db.delete(existing_schedule)

        await self.db.commit()
        await self.db.refresh(workflow)
        return workflow

    async def toggle_schedule(self, workflow: Workflow) -> bool:
        """Toggle the is_active flag on the workflow's schedule.

        Returns the new is_active value.
        Raises NotFound if the workflow has no schedule.
        """
        stmt = select(ScheduledWorkflow).where(
            ScheduledWorkflow.workflow_id == workflow.id
        )
        result = await self.db.exec(stmt)
        schedule = result.first()
        if not schedule:
            raise NotFound(detail="No schedule found for this workflow")

        schedule.is_active = not schedule.is_active
        workflow.workflow_data = self._update_schedule_node(
            workflow.workflow_data,
            is_active=schedule.is_active,
        )
        self.db.add(workflow)
        self.db.add(schedule)
        await self.db.commit()
        await self.db.refresh(schedule)
        return schedule.is_active

    async def delete(self, workflow: Workflow) -> None:
        """Hard-delete the given Workflow and commit the change."""
        stmt = delete(WorkflowUser).where(WorkflowUser.workflow_id == workflow.id)
        await self.db.exec(stmt)
        await self.db.commit()

        await self.db.delete(workflow)
        await self.db.commit()

    async def resolve_workflow_credentials(self, workflow_data: dict) -> dict:
        """Resolve credentials for all nodes in the workflow."""
        resolved_data = copy.deepcopy(workflow_data)
        nodes = resolved_data.get("nodes", [])

        for node in nodes:
            if "credentials" in node and isinstance(node["credentials"], dict):
                cred_ref = node["credentials"]
                if "id" in cred_ref:
                    credential_id = cred_ref["id"]
                    if isinstance(credential_id, str):
                        credential_id = int(credential_id)

                    credential: WorkflowCredential | None = await self.db.get(
                        WorkflowCredential, credential_id
                    )
                    if not credential:
                        raise NotFound(
                            detail=f"Credential with ID {credential_id} not found"
                        )

                    decrypted_data = self.encryptor.decrypt_credential_data(
                        credential.credential_data
                    )
                    node["credentials"] = {
                        "id": str(credential.id),
                        "name": credential.name,
                        "type": credential.credential_type.value,
                        "values": decrypted_data,
                    }

        return resolved_data

    def _detect_trigger_type(self, workflow_data: dict) -> TriggerType:
        """Detect trigger type from workflow nodes."""
        nodes = workflow_data.get("nodes", [])

        for node in nodes:
            node_type = node.get("type", "")
            if node_type == "ScheduleTrigger" and node.get("trigger") is True:
                parameters = node.get("parameters", {})
                if "interval_seconds" in parameters:
                    return TriggerType.SCHEDULED
            if node_type == "WebhookTrigger" and node.get("trigger") is True:
                return TriggerType.WEBHOOK

        return TriggerType.MANUAL

    def extract_schedule_config(self, workflow_data: dict) -> dict | None:
        """Extract schedule configuration from workflow nodes."""
        nodes = workflow_data.get("nodes", [])

        for node in nodes:
            node_type = node.get("type", "")
            if node_type == "ScheduleTrigger" and node.get("trigger") is True:
                parameters = node.get("parameters", {})
                if "interval_seconds" in parameters:
                    config = {
                        "interval_seconds": parameters["interval_seconds"],
                        "is_active": parameters.get("is_active", True),
                    }
                    if "start_at" in parameters:
                        config["start_at"] = self._normalize_datetime(
                            parameters["start_at"]
                        )
                    return config

        return None

    def _normalize_datetime(self, value: str | datetime) -> datetime:
        """Normalize a datetime value to naive UTC."""
        if isinstance(value, str):
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is not None:
                return parsed.astimezone(timezone.utc).replace(tzinfo=None)
            return parsed
        if isinstance(value, datetime) and value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def _update_schedule_node(self, workflow_data: dict, **parameters: object) -> dict:
        """Return workflow data with the schedule node parameters updated."""
        updated_workflow_data = copy.deepcopy(workflow_data)

        for node in updated_workflow_data.get("nodes", []):
            if node.get("type") == "ScheduleTrigger" and node.get("trigger") is True:
                node_parameters = node.setdefault("parameters", {})
                node_parameters.update(parameters)
                break

        return updated_workflow_data

    def _calculate_next_run(
        self,
        from_time: datetime,
        interval_seconds: int,
        start_at: datetime | None = None,
    ) -> datetime:
        """Calculate next run time from interval and optional start time."""
        if start_at and start_at > from_time:
            return start_at
        return from_time + timedelta(seconds=interval_seconds)
