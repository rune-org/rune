from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator
from src.db.models import TriggerType, WorkflowRole


class ScheduleInfo(BaseModel):
    """Minimal schedule info for workflow list views."""

    is_active: bool

    model_config = {"from_attributes": True}


class WorkflowListItem(BaseModel):
    id: int
    name: str
    trigger_type: TriggerType = TriggerType.MANUAL
    role: WorkflowRole
    schedule: Optional[ScheduleInfo] = None


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


class WorkflowUpdateData(BaseModel):
    workflow_data: dict[str, Any] = Field(..., description="Updated workflow data")


class WorkflowDetail(BaseModel):
    id: int
    name: str
    description: Optional[str]
    workflow_data: dict[str, Any]
    version: int
    trigger_type: TriggerType
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NodeExecutionMessage(BaseModel):
    """Message to trigger workflow node execution."""

    workflow_id: str
    execution_id: str
    current_node: str
    workflow_definition: dict[str, Any]
    accumulated_context: dict[str, Any] = Field(default_factory=dict)
