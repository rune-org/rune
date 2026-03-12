from datetime import datetime
from typing import Any, Optional

from fastapi import status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from src.core.responses import ApiResponse
from src.db.models import User, Workflow, WorkflowRole, WorkflowVersion


class WorkflowListItem(BaseModel):
    id: int
    name: str
    is_active: bool
    role: WorkflowRole


def normalize_and_validate_name(value: str, *, field_name: str = "name") -> str:
    """Validate a name field.

    Ensures the resulting value is not empty.

    Args:
        value: The raw input value.
        field_name: Optional field name used in the error message.

    Returns:
        The stripped string.

    Raises:
        ValueError: If the stripped value is empty.
    """
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} cannot be blank")
    return normalized


class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = Field(default="")

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        return normalize_and_validate_name(v)


class WorkflowUpdateName(BaseModel):
    name: str = Field(..., min_length=1)

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        return normalize_and_validate_name(v)


class WorkflowUpdateStatus(BaseModel):
    is_active: bool


class WorkflowVersionCreator(BaseModel):
    id: int
    name: str

    @classmethod
    def from_user(cls, user: User | None) -> Optional["WorkflowVersionCreator"]:
        if user is None:
            return None
        return cls(id=user.id, name=user.name)


class WorkflowVersionListItem(BaseModel):
    id: int
    version: int
    created_at: datetime
    created_by: Optional[WorkflowVersionCreator] = None
    message: Optional[str] = None
    is_published: bool

    @classmethod
    def from_version(
        cls,
        version: WorkflowVersion,
        published_version_id: int | None,
        creator: User | None = None,
    ) -> "WorkflowVersionListItem":
        return cls(
            id=version.id,
            version=version.version,
            created_at=version.created_at,
            created_by=WorkflowVersionCreator.from_user(creator),
            message=version.message,
            is_published=version.id == published_version_id,
        )


class WorkflowVersionDetail(WorkflowVersionListItem):
    workflow_data: dict[str, Any]

    @classmethod
    def from_version(
        cls,
        version: WorkflowVersion,
        published_version_id: int | None,
        creator: User | None = None,
    ) -> "WorkflowVersionDetail":
        base = WorkflowVersionListItem.from_version(
            version, published_version_id, creator
        )
        return cls(**base.model_dump(), workflow_data=version.workflow_data)


class WorkflowDetail(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_active: bool
    latest_version: Optional[WorkflowVersionDetail] = None
    published_version_id: Optional[int] = None
    has_unpublished_changes: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_workflow(
        cls,
        workflow: Workflow,
        latest_version: tuple[WorkflowVersion, User | None] | None,
    ) -> "WorkflowDetail":
        latest_version_payload = None
        if latest_version is not None:
            version, creator = latest_version
            latest_version_payload = WorkflowVersionDetail.from_version(
                version,
                workflow.published_version_id,
                creator,
            )

        return cls(
            id=workflow.id,
            name=workflow.name,
            description=workflow.description,
            is_active=workflow.is_active,
            latest_version=latest_version_payload,
            published_version_id=workflow.published_version_id,
            has_unpublished_changes=(
                workflow.latest_version_id is not None
                and workflow.latest_version_id != workflow.published_version_id
            ),
            created_at=workflow.created_at,
            updated_at=workflow.updated_at,
        )


class WorkflowCreateVersion(BaseModel):
    base_version_id: Optional[int] = Field(
        default=None,
        description="Expected current latest version id. Null is allowed only for the first save.",
    )
    workflow_data: dict[str, Any] = Field(
        ..., description="Workflow definition to save"
    )
    message: Optional[str] = Field(default=None, description="Revision message")


class WorkflowPublishVersion(BaseModel):
    version_id: int


class WorkflowRestoreVersion(BaseModel):
    message: Optional[str] = Field(default=None, description="Revision message")


class WorkflowRunRequest(BaseModel):
    version_id: Optional[int] = Field(
        default=None,
        description="Specific workflow version to run. Defaults to the published version.",
    )


class WorkflowVersionConflict(BaseModel):
    server_version: int
    server_version_id: int

    @classmethod
    def from_error(
        cls, server_version: int, server_version_id: int
    ) -> "WorkflowVersionConflict":
        return cls(
            server_version=server_version,
            server_version_id=server_version_id,
        )

    @classmethod
    def to_response(cls, server_version: int, server_version_id: int) -> JSONResponse:
        payload = ApiResponse[WorkflowVersionConflict](
            success=False,
            message="version_conflict",
            data=cls.from_error(server_version, server_version_id),
        )
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=payload.model_dump(),
        )


class NodeExecutionMessage(BaseModel):
    """Message to trigger workflow node execution."""

    workflow_id: str
    workflow_version: int
    workflow_version_id: int
    execution_id: str
    current_node: str
    workflow_definition: dict[str, Any]
    accumulated_context: dict[str, Any] = Field(default_factory=dict)
