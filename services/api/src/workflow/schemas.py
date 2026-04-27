from datetime import datetime
from enum import Enum
from typing import Any, Optional

from fastapi import status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, StrictBool, field_validator

from src.core.responses import ApiResponse
from src.db.models import User, Workflow, WorkflowRole, WorkflowVersion


class WorkflowListItem(BaseModel):
    id: int
    name: str
    description: Optional[str] = Field(default=None)
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
    is_active: StrictBool


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

    @field_validator("workflow_data")
    @classmethod
    def _validate_workflow_data(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Validate workflow data structure.

        Ensures required fields and basic structure are present.
        """
        if not isinstance(v, dict):
            raise ValueError("workflow_data must be an object")

        if not v:
            raise ValueError("workflow_data cannot be empty")

        # Check for required fields
        if "nodes" not in v:
            raise ValueError("workflow_data must contain 'nodes' field")
        if "edges" not in v:
            raise ValueError("workflow_data must contain 'edges' field")

        nodes = v.get("nodes")
        if not isinstance(nodes, list):
            raise ValueError("'nodes' must be an array")
        if not nodes:
            raise ValueError("'nodes' array cannot be empty")

        edges = v.get("edges")
        if not isinstance(edges, list):
            raise ValueError("'edges' must be an array")

        # Validate each node has an id
        for i, node in enumerate(nodes):
            if not isinstance(node, dict):
                raise ValueError(f"Node at index {i} must be an object")
            if "id" not in node:
                raise ValueError(f"Node at index {i} must have 'id' field")
            if not node["id"]:
                raise ValueError(f"Node at index {i} has empty 'id'")

        # Validate trigger node exists
        trigger_nodes = [node for node in nodes if node.get("trigger", False)]
        if not trigger_nodes:
            raise ValueError("Workflow must have at least one trigger node")
        if len(trigger_nodes) > 1:
            raise ValueError("Workflow must have exactly one trigger node")

        return v


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


# ---------------------------------------------------------------------------
# Bulk-operation schemas
# ---------------------------------------------------------------------------


class BulkWorkflowAction(str, Enum):
    """Actions that can be applied to multiple workflows at once."""

    DELETE = "delete"
    ACTIVATE = "activate"
    DEACTIVATE = "deactivate"
    EXPORT = "export"
    RUN = "run"


class BulkWorkflowRequest(BaseModel):
    """Request body for the bulk-workflow endpoint."""

    workflow_ids: list[int] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="IDs of the workflows to operate on (1–100 items; duplicates are ignored).",
    )
    action: BulkWorkflowAction

    @field_validator("workflow_ids")
    @classmethod
    def _dedup_and_validate(cls, v: list[int]) -> list[int]:
        seen: set[int] = set()
        result: list[int] = []
        for wf_id in v:
            if wf_id <= 0:
                raise ValueError("All workflow IDs must be positive integers")
            if wf_id not in seen:
                seen.add(wf_id)
                result.append(wf_id)
        return result


class BulkWorkflowFailure(BaseModel):
    """A single workflow that could not be processed in a bulk operation."""

    id: int
    reason: str  # "not_found" | "forbidden" | "invalid_workflow"


class BulkOperationSummary(BaseModel):
    """Aggregate counts for a completed bulk operation."""

    total: int
    succeeded: int
    failed: int


class BulkOperationResult(BaseModel):
    """Full result returned by the bulk-workflow endpoint."""

    action: str
    succeeded: list[int]
    failed: list[BulkWorkflowFailure]
    summary: BulkOperationSummary
    # Populated only for the `export` action.
    exported: Optional[list[WorkflowDetail]] = None
    # Populated only for the `run` action: maps workflow_id to execution_id for RTES subscriptions.
    executions: Optional[dict[int, str]] = None
