import copy

from sqlalchemy.exc import IntegrityError
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.exceptions import BadRequest, Forbidden, NotFound
from src.credentials.encryption import get_encryptor
from src.db.models import (
    User,
    Workflow,
    WorkflowCredential,
    WorkflowRole,
    WorkflowUser,
    WorkflowVersion,
)


class WorkflowVersionConflictError(Exception):
    def __init__(self, server_version: int, server_version_id: int):
        self.server_version = server_version
        self.server_version_id = server_version_id
        super().__init__("version_conflict")


class WorkflowService:
    """Database service for workflows and immutable workflow versions."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.encryptor = get_encryptor()

    async def list_for_user(self, user_id: int) -> list[tuple[Workflow, WorkflowRole]]:
        statement = (
            select(Workflow, WorkflowUser.role)
            .join(WorkflowUser)
            .where(WorkflowUser.user_id == user_id)
            .order_by(Workflow.updated_at.desc())
        )
        result = await self.db.exec(statement)
        return result.all()

    async def get_by_id(self, workflow_id: int) -> Workflow | None:
        return await self.db.get(Workflow, workflow_id)

    async def get_for_user(self, workflow_id: int, user_id: int) -> Workflow:
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
        workflow.name = name
        await self.db.commit()
        await self.db.refresh(workflow)
        return workflow

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

    async def get_latest_version(
        self, workflow: Workflow
    ) -> WorkflowVersion | None:
        if workflow.latest_version_id is None:
            return None
        return await self.get_version(workflow.id, workflow.latest_version_id)

    async def get_latest_version_with_creator(
        self, workflow: Workflow
    ) -> tuple[WorkflowVersion, User | None] | None:
        if workflow.latest_version_id is None:
            return None
        return await self.get_version_with_creator(workflow.id, workflow.latest_version_id)

    async def get_run_version(
        self, workflow: Workflow, version_id: int | None
    ) -> WorkflowVersion:
        if version_id is None:
            version = await self.get_latest_version(workflow)
            if not version:
                raise BadRequest(detail="Workflow has no saved versions")
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
        stmt = delete(WorkflowUser).where(WorkflowUser.workflow_id == workflow.id)
        await self.db.exec(stmt)
        await self.db.commit()

        await self.db.delete(workflow)
        await self.db.commit()

    async def resolve_workflow_credentials(self, workflow_data: dict) -> dict:
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

    async def _lock_workflow(self, workflow_id: int) -> Workflow:
        statement = (
            select(Workflow)
            .where(Workflow.id == workflow_id)
            .with_for_update()
        )
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
