import copy
import io
import json
import re
import uuid
import zipfile
from datetime import datetime
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlmodel import col, delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.exceptions import BadRequest, Forbidden, NotFound
from src.credentials.encryption import get_encryptor
from src.db.models import (
    Execution,
    ExecutionStatus,
    ScheduledWorkflow,
    User,
    Workflow,
    WorkflowCredential,
    WorkflowRole,
    WorkflowUser,
    WorkflowVersion,
)


from src.workflow.constants import (
    SCHEDULED_TRIGGER_TYPE,
    SCHEDULED_TRIGGER_PARAM_AMOUNT,
    SCHEDULED_TRIGGER_PARAM_UNIT,
    SCHEDULED_TRIGGER_UNIT_MULTIPLIERS,
)


class WorkflowVersionConflictError(Exception):
    def __init__(self, server_version: int, server_version_id: int):
        self.server_version = server_version
        self.server_version_id = server_version_id
        super().__init__("version_conflict")


class WorkflowService:
    """Database service for Workflow objects and immutable WorkflowVersion rows.

    Holds a DB session and exposes simple methods used by API routers:
    listing, retrieval, creation, versioning, and deletion.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.encryptor = get_encryptor()

    async def list_for_user(self, user_id: int) -> list[tuple[Workflow, WorkflowRole]]:
        """Return workflows visible to `user_id`, newest first.

        Used for the `GET /workflows` endpoint.
        """
        statement = (
            select(Workflow, WorkflowUser.role)
            .join(WorkflowUser)
            .where(WorkflowUser.user_id == user_id)
            .order_by(Workflow.updated_at.desc())
        )
        result = await self.db.exec(statement)
        return result.all()

    async def get_by_id(self, workflow_id: int) -> Workflow | None:
        """Return a Workflow by primary key or None if not found."""
        return await self.db.get(Workflow, workflow_id)

    async def get_for_user(self, workflow_id: int, user_id: int) -> Workflow:
        """Fetch a workflow and enforce that `user_id` has access to it.

        Raises NotFound if the workflow doesn't exist, or Forbidden if the
        user has no permission entry. This centralizes access checks for
        callers so routers remain concise.
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

    async def create(self, user_id: int, name: str, description: str) -> Workflow:
        """Create and persist a new workflow shell owned by `user_id`."""
        wf = Workflow(name=name, description=description)
        self.db.add(wf)
        await self.db.flush()

        owner = WorkflowUser(
            workflow_id=wf.id,
            user_id=user_id,
            role=WorkflowRole.OWNER,
            granted_by=user_id,
        )
        self.db.add(owner)
        await self.db.commit()
        await self.db.refresh(wf)
        return wf

    async def update_name(self, workflow: Workflow, name: str) -> Workflow:
        """Update only the workflow's name and persist the change."""
        workflow.name = name
        await self.db.commit()
        await self.db.refresh(workflow)
        return workflow

    async def update_status(self, workflow: Workflow, is_active: bool) -> Workflow:
        """Update publish status using the versioned workflow model.

        `is_active=True` publishes the latest saved version.
        `is_active=False` clears the published pointer.
        """
        locked_workflow = await self._lock_workflow(workflow.id)

        if is_active:
            latest = await self.get_latest_version(locked_workflow)
            if not latest:
                raise BadRequest(detail="Workflow has no saved versions")
            locked_workflow.published_version_id = latest.id
            locked_workflow.is_active = True
            await self._upsert_schedule(locked_workflow.id, latest.workflow_data)
        else:
            locked_workflow.published_version_id = None
            locked_workflow.is_active = False
            await self._delete_schedule(locked_workflow.id)

        await self.db.commit()
        await self.db.refresh(locked_workflow)
        return locked_workflow

    async def create_version(
        self,
        workflow: Workflow,
        user_id: int,
        workflow_data: dict,
        base_version_id: int | None,
        message: str | None = None,
    ) -> WorkflowVersion:
        locked_workflow = await self._lock_workflow(workflow.id)
        current_latest = await self.get_latest_version(locked_workflow)

        if current_latest is None:
            if base_version_id is not None:
                raise BadRequest(
                    detail="base_version_id must be null when creating the first version"
                )
            next_version_number = 1
        else:
            if base_version_id != current_latest.id:
                raise WorkflowVersionConflictError(
                    server_version=current_latest.version,
                    server_version_id=current_latest.id,
                )
            next_version_number = current_latest.version + 1

        version = WorkflowVersion(
            workflow_id=locked_workflow.id,
            version=next_version_number,
            workflow_data=workflow_data,
            created_by=user_id,
            message=self._normalize_message(message),
        )
        self.db.add(version)

        try:
            await self.db.flush()
        except IntegrityError:
            await self.db.rollback()
            latest = await self._get_latest_version_by_workflow_id(workflow.id)
            if latest:
                raise WorkflowVersionConflictError(
                    server_version=latest.version,
                    server_version_id=latest.id,
                )
            raise

        locked_workflow.latest_version_id = version.id
        locked_workflow.is_active = locked_workflow.published_version_id is not None
        await self.db.commit()
        await self.db.refresh(version)
        return version

    async def publish_version(self, workflow: Workflow, version_id: int) -> Workflow:
        locked_workflow = await self._lock_workflow(workflow.id)
        version = await self.get_version(workflow.id, version_id)
        if not version:
            raise NotFound(detail="Workflow version not found")

        locked_workflow.published_version_id = version.id
        locked_workflow.is_active = True
        await self._upsert_schedule(locked_workflow.id, version.workflow_data)
        await self.db.commit()
        await self.db.refresh(locked_workflow)
        return locked_workflow

    async def restore_version(
        self,
        workflow: Workflow,
        source_version_id: int,
        user_id: int,
        message: str | None = None,
    ) -> WorkflowVersion:
        locked_workflow = await self._lock_workflow(workflow.id)
        source_version = await self.get_version(workflow.id, source_version_id)
        if not source_version:
            raise NotFound(detail="Workflow version not found")

        latest = await self.get_latest_version(locked_workflow)
        next_version_number = 1 if latest is None else latest.version + 1
        version = WorkflowVersion(
            workflow_id=locked_workflow.id,
            version=next_version_number,
            workflow_data=copy.deepcopy(source_version.workflow_data),
            created_by=user_id,
            message=self._normalize_message(message)
            or f"Restored from v{source_version.version}",
        )
        self.db.add(version)
        await self.db.flush()

        locked_workflow.latest_version_id = version.id
        locked_workflow.is_active = locked_workflow.published_version_id is not None
        await self.db.commit()
        await self.db.refresh(version)
        return version

    async def get_version(
        self, workflow_id: int, version_id: int
    ) -> WorkflowVersion | None:
        statement = select(WorkflowVersion).where(
            WorkflowVersion.workflow_id == workflow_id,
            WorkflowVersion.id == version_id,
        )
        result = await self.db.exec(statement)
        return result.first()

    async def get_version_with_creator(
        self, workflow_id: int, version_id: int
    ) -> tuple[WorkflowVersion, User | None] | None:
        statement = (
            select(WorkflowVersion, User)
            .outerjoin(User, User.id == WorkflowVersion.created_by)
            .where(
                WorkflowVersion.workflow_id == workflow_id,
                WorkflowVersion.id == version_id,
            )
        )
        result = await self.db.exec(statement)
        return result.first()

    async def list_versions(
        self, workflow_id: int
    ) -> list[tuple[WorkflowVersion, User | None]]:
        statement = (
            select(WorkflowVersion, User)
            .outerjoin(User, User.id == WorkflowVersion.created_by)
            .where(WorkflowVersion.workflow_id == workflow_id)
            .order_by(WorkflowVersion.version.desc())
        )
        result = await self.db.exec(statement)
        return result.all()

    async def get_latest_version(self, workflow: Workflow) -> WorkflowVersion | None:
        if workflow.latest_version_id is None:
            return None
        return await self.get_version(workflow.id, workflow.latest_version_id)

    async def get_latest_version_with_creator(
        self, workflow: Workflow
    ) -> tuple[WorkflowVersion, User | None] | None:
        if workflow.latest_version_id is None:
            return None
        return await self.get_version_with_creator(
            workflow.id, workflow.latest_version_id
        )

    async def get_run_version(
        self, workflow: Workflow, version_id: int | None
    ) -> WorkflowVersion:
        if version_id is None:
            if workflow.published_version_id is None:
                raise BadRequest(detail="Workflow has no published version")

            version = await self.get_version(workflow.id, workflow.published_version_id)
            if not version:
                raise NotFound(detail="Workflow published version not found")
            return version

        version = await self.get_version(workflow.id, version_id)
        if not version:
            raise NotFound(detail="Workflow version not found")
        return version

    async def get_latest_workflow_data(self, workflow: Workflow) -> dict | None:
        latest = await self.get_latest_version(workflow)
        if latest is None:
            return None
        return copy.deepcopy(latest.workflow_data)

    async def delete(self, workflow: Workflow) -> None:
        """Hard-delete the given Workflow and commit the change.

        Delete related executions and access rows first, then delete the workflow.
        """
        workflow_id = workflow.id
        if workflow_id is None:
            raise NotFound(detail="Workflow not found")

        stmt = delete(Execution).where(Execution.workflow_id == workflow_id)
        await self.db.exec(stmt)

        stmt = delete(WorkflowUser).where(WorkflowUser.workflow_id == workflow_id)
        await self.db.exec(stmt)

        stmt = delete(ScheduledWorkflow).where(
            ScheduledWorkflow.workflow_id == workflow_id
        )
        await self.db.exec(stmt)

        await self.db.delete(workflow)
        await self.db.commit()

    # ------------------------------------------------------------------
    # Bulk helpers
    # ------------------------------------------------------------------

    @staticmethod
    def sanitize_workflow_data_for_export(workflow_data: Any) -> dict[str, Any]:
        """Return workflow_data safe for user download.

        Removes credential references from node payloads so exports never
        include secret-bearing fields.
        """
        if not isinstance(workflow_data, dict):
            return {"nodes": [], "edges": []}

        sanitized = copy.deepcopy(workflow_data)
        nodes = sanitized.get("nodes")
        edges = sanitized.get("edges")

        if not isinstance(nodes, list):
            nodes = []
        if not isinstance(edges, list):
            edges = []

        sanitized_nodes: list[dict[str, Any]] = []
        for node in nodes:
            if not isinstance(node, dict):
                continue

            cleaned = dict(node)
            cleaned.pop("credentials", None)

            data = cleaned.get("data")
            if isinstance(data, dict):
                cleaned_data = dict(data)
                cleaned_data.pop("credential", None)
                cleaned["data"] = cleaned_data

            sanitized_nodes.append(cleaned)

        return {
            "nodes": sanitized_nodes,
            "edges": edges,
        }

    @staticmethod
    def build_export_file_name(workflow_id: int, workflow_name: str) -> str:
        safe_name = re.sub(
            r"[^A-Za-z0-9_-]", "_", (workflow_name or "workflow").strip()
        )
        safe_name = safe_name or "workflow"
        return f"workflow-{safe_name}-{workflow_id}.json"

    async def build_bulk_export_zip(self, workflows: list[Workflow]) -> bytes:
        """Create a ZIP archive containing one sanitized JSON per workflow."""
        if not workflows:
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED):
                pass
            return buffer.getvalue()

        latest_version_ids = {
            wf.latest_version_id for wf in workflows if wf.latest_version_id is not None
        }
        versions_by_id: dict[int, WorkflowVersion] = {}

        if latest_version_ids:
            stmt = select(WorkflowVersion).where(
                col(WorkflowVersion.id).in_(latest_version_ids)
            )
            result = await self.db.exec(stmt)
            versions_by_id = {version.id: version for version in result.all()}

        buffer = io.BytesIO()
        with zipfile.ZipFile(
            buffer, mode="w", compression=zipfile.ZIP_DEFLATED
        ) as archive:
            for workflow in workflows:
                if workflow.latest_version_id is None:
                    continue

                version = versions_by_id.get(workflow.latest_version_id)
                if version is None:
                    continue

                payload = self.sanitize_workflow_data_for_export(version.workflow_data)
                file_name = self.build_export_file_name(workflow.id, workflow.name)
                archive.writestr(file_name, json.dumps(payload, indent=2))

        return buffer.getvalue()

    async def build_bulk_export_response(
        self,
        workflow_ids: list[int],
        workflows: list[Workflow],
    ) -> tuple[bytes, str]:
        """Build ZIP bytes and a safe filename for bulk export downloads."""
        archive_bytes = await self.build_bulk_export_zip(workflows)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        file_name = f"workflows-export-{timestamp}-{len(workflow_ids)}.zip"
        return archive_bytes, file_name

    async def bulk_fetch_with_roles(
        self, user_id: int, workflow_ids: list[int]
    ) -> dict[int, tuple[Workflow, WorkflowRole | None]]:
        """Fetch multiple workflows and the requesting user's role on each.

        Uses two efficient bulk queries instead of N individual lookups.
        Keys are only present for workflow IDs that actually exist in the
        database.  The role value is ``None`` when the user has no
        ``WorkflowUser`` entry (i.e. no access at all).
        """
        wf_stmt = select(Workflow).where(col(Workflow.id).in_(workflow_ids))
        wf_result = await self.db.exec(wf_stmt)
        workflows: dict[int, Workflow] = {wf.id: wf for wf in wf_result.all()}

        if not workflows:
            return {}

        role_stmt = select(WorkflowUser.workflow_id, WorkflowUser.role).where(
            WorkflowUser.user_id == user_id,
            col(WorkflowUser.workflow_id).in_(list(workflows.keys())),
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
            delete(Execution).where(col(Execution.workflow_id).in_(workflow_ids))
        )
        await self.db.exec(
            delete(WorkflowUser).where(col(WorkflowUser.workflow_id).in_(workflow_ids))
        )
        await self.db.exec(
            delete(ScheduledWorkflow).where(
                col(ScheduledWorkflow.workflow_id).in_(workflow_ids)
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
        user_id: int | None,
        queue_service,
        token_service=None,
        version_id: int | None = None,
    ) -> str:
        """Queue a workflow for execution and return the execution_id.

        Handles:
        - Resolving the correct version to run (published or specific version)
        - Resolving credentials in workflow data
        - Creating execution record in database
        - Publishing execution token for real-time updates (only if user_id and token_service provided)
        - Publishing workflow run message to RabbitMQ

        Args:
            workflow: The workflow to execute
            user_id: ID of the user triggering execution (None for scheduler-triggered executions)
            queue_service: WorkflowQueueService for publishing run messages
            token_service: ExecutionTokenService for publishing tokens
            version_id: Optional specific version to run; defaults to published version

        Returns:
            execution_id (UUID string) for tracking

        Raises:
            ValueError: If workflow structure is invalid (missing trigger, etc.)
            BadRequest: If workflow has no published version and version_id is None
            NotFound: If specified version doesn't exist
        """
        # Get the version to run (published or specific)
        version = await self.get_run_version(workflow, version_id)

        # Resolve credentials for all nodes in the workflow
        resolved_workflow_data = await self.resolve_workflow_credentials(
            version.workflow_data
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

        # Publish execution token for RTES authentication (only for user-triggered executions)
        if token_service is not None:
            await token_service.publish_execution_token(
                workflow_id=workflow.id,
                user_id=user_id,
                execution_id=execution_id,
            )

        # Publish workflow run message to queue with resolved credentials
        # This may raise ValueError if workflow structure is invalid
        await queue_service.publish_workflow_run(
            workflow_id=workflow.id,
            workflow_version=version.version,
            workflow_version_id=version.id,
            execution_id=execution_id,
            workflow_data=resolved_workflow_data,
        )

        return execution_id

    async def resolve_workflow_credentials(self, workflow_data: dict) -> dict:
        """
        Resolve credentials for all nodes in the workflow definition.

        Iterates through all nodes in the workflow_data, finds nodes with
        credential references, fetches the actual credential from the database,
        decrypts it, and embeds the resolved values in place.

        Args:
            workflow_data: The workflow definition containing nodes and edges.

        Returns:
            Updated workflow_data with resolved credentials embedded in nodes.

        Raises:
            NotFound: If a referenced credential doesn't exist.
        """
        resolved_data = copy.deepcopy(workflow_data)
        nodes = resolved_data.get("nodes", [])

        for node in nodes:
            # Check if this node has a credentials reference.
            if "credentials" in node and isinstance(node["credentials"], dict):
                cred_ref = node["credentials"]

                # If it has an id field, it's a reference that needs resolving.
                if "id" in cred_ref:
                    credential_id = cred_ref["id"]

                    # Convert string ID to int if needed.
                    if isinstance(credential_id, str):
                        credential_id = int(credential_id)

                    # Fetch the credential from database.
                    credential: WorkflowCredential | None = await self.db.get(
                        WorkflowCredential, credential_id
                    )

                    if not credential:
                        raise NotFound(
                            detail=f"Credential with ID {credential_id} not found"
                        )

                    # Decrypt the credential data.
                    decrypted_data = self.encryptor.decrypt_credential_data(
                        credential.credential_data
                    )

                    # Replace the credentials reference with resolved values.
                    node["credentials"] = {
                        "id": str(credential.id),
                        "name": credential.name,
                        "type": credential.credential_type.value,
                        "values": decrypted_data,
                    }

        return resolved_data

    # ------------------------------------------------------------------
    # Schedule sync helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_interval_seconds(parameters: dict) -> int:
        """Convert {amount, unit} parameters to total seconds."""
        amount = parameters.get(SCHEDULED_TRIGGER_PARAM_AMOUNT)
        unit = parameters.get(SCHEDULED_TRIGGER_PARAM_UNIT)
        if amount is None or unit is None:
            raise ValueError(
                f"{SCHEDULED_TRIGGER_TYPE} requires "
                f"'{SCHEDULED_TRIGGER_PARAM_AMOUNT}' and '{SCHEDULED_TRIGGER_PARAM_UNIT}' parameters"
            )
        if unit not in SCHEDULED_TRIGGER_UNIT_MULTIPLIERS:
            raise ValueError(
                f"{SCHEDULED_TRIGGER_TYPE} '{SCHEDULED_TRIGGER_PARAM_UNIT}' must be one of "
                f"{list(SCHEDULED_TRIGGER_UNIT_MULTIPLIERS)}, got '{unit}'"
            )
        return int(amount * SCHEDULED_TRIGGER_UNIT_MULTIPLIERS[unit])

    @staticmethod
    def _find_scheduled_trigger(workflow_data: dict) -> dict | None:
        """Return the ScheduledTrigger node dict, or None if absent."""
        for node in workflow_data.get("nodes", []):
            if node.get("type") == SCHEDULED_TRIGGER_TYPE:
                return node
        return None

    async def _delete_schedule(self, workflow_id: int) -> None:
        """Remove the scheduled_workflows row if it exists."""
        stmt = select(ScheduledWorkflow).where(
            ScheduledWorkflow.workflow_id == workflow_id
        )
        result = await self.db.exec(stmt)
        existing = result.first()
        if existing is not None:
            await self.db.delete(existing)

    async def _upsert_schedule(self, workflow_id: int, workflow_data: dict) -> None:
        """Create or update the scheduled_workflows row from workflow data.

        If the workflow has no ScheduledTrigger node, removes the row instead.
        Only resets next_run_at when the interval changes.
        """
        trigger_node = self._find_scheduled_trigger(workflow_data)

        if trigger_node is None:
            await self._delete_schedule(workflow_id)
            return

        interval_seconds = self._compute_interval_seconds(
            trigger_node.get("parameters", {})
        )

        stmt = select(ScheduledWorkflow).where(
            ScheduledWorkflow.workflow_id == workflow_id
        )
        result = await self.db.exec(stmt)
        existing = result.first()

        if existing is None:
            self.db.add(
                ScheduledWorkflow(
                    workflow_id=workflow_id,
                    interval_seconds=interval_seconds,
                    next_run_at=datetime.now(),
                )
            )
        else:
            if existing.interval_seconds != interval_seconds:
                existing.interval_seconds = interval_seconds
                existing.next_run_at = datetime.now()

    async def _lock_workflow(self, workflow_id: int) -> Workflow:
        statement = select(Workflow).where(Workflow.id == workflow_id).with_for_update()
        result = await self.db.exec(statement)
        workflow = result.first()
        if not workflow:
            raise NotFound(detail="Workflow not found")
        return workflow

    async def _get_latest_version_by_workflow_id(
        self, workflow_id: int
    ) -> WorkflowVersion | None:
        statement = (
            select(WorkflowVersion)
            .where(WorkflowVersion.workflow_id == workflow_id)
            .order_by(WorkflowVersion.version.desc())
            .limit(1)
        )
        result = await self.db.exec(statement)
        return result.first()

    @staticmethod
    def _normalize_message(message: str | None) -> str | None:
        if message is None:
            return None

        normalized = message.strip()
        return normalized or None
