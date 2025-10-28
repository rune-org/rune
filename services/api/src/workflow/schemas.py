from typing import Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class WorkflowListItem(BaseModel):
    id: int
    name: str
    is_active: bool


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
    workflow_id: str
    execution_id: str
    current_node: str
    workflow_definition: dict[str, Any]
    accumulated_context: dict[str, Any] = Field(default_factory=dict)
