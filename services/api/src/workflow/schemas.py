from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator
from src.db.models import WorkflowRole


class WorkflowListItem(BaseModel):
    id: int
    name: str
    is_active: bool
    role: WorkflowRole


def normalize_and_validate_name(value: str, *, field_name: str = "name") -> str:
    """validate a name field.
    - Ensures the resulting value is not empty.

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
    workflow_data: dict[str, Any] = Field(default_factory=dict)

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


class WorkflowUpdateData(BaseModel):
    workflow_data: dict[str, Any] = Field(..., description="Updated workflow data")


class WorkflowDetail(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_active: bool
    workflow_data: dict[str, Any]
    version: int
    created_at: datetime
    updated_at: datetime

    # Allow constructing the model directly from object attributes (SQLModel/ORM
    # instances) when using Pydantic v2. This lets callers do
    # `WorkflowDetail.model_validate(wf)` instead of manual field mapping.
    model_config = {"from_attributes": True}


class NodeExecutionMessage(BaseModel):
    """Message to trigger workflow node execution."""

    workflow_id: str
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
