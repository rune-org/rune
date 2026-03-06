from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

from src.db.models import WorkflowRole


class WorkflowListItem(BaseModel):
    id: int
    name: str
    is_active: bool
    role: WorkflowRole


def normalize_and_validate_name(value: str, *, field_name: str = "name") -> str:
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


class WorkflowVersionCreator(BaseModel):
    id: int
    name: str


class WorkflowVersionListItem(BaseModel):
    id: int
    version: int
    created_at: datetime
    created_by: Optional[WorkflowVersionCreator] = None
    message: Optional[str] = None
    is_published: bool


class WorkflowVersionDetail(WorkflowVersionListItem):
    workflow_data: dict[str, Any]


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
        description="Specific workflow version to run. Defaults to the latest version.",
    )


class WorkflowVersionConflict(BaseModel):
    server_version: int
    server_version_id: int


class NodeExecutionMessage(BaseModel):
    """Message to trigger workflow node execution."""

    workflow_id: str
    workflow_version: int
    workflow_version_id: int
    execution_id: str
    current_node: str
    workflow_definition: dict[str, Any]
    accumulated_context: dict[str, Any] = Field(default_factory=dict)
