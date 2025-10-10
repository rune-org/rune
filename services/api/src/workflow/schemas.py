from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class WorkflowListItem(BaseModel):
    id: int
    name: str
    is_active: bool


class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = Field(default="")
    workflow_data: Dict[str, Any] = Field(default_factory=dict)


class WorkflowUpdateName(BaseModel):
    name: str = Field(..., min_length=1)


class WorkflowUpdateStatus(BaseModel):
    is_active: bool


class WorkflowDetail(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_active: bool
    workflow_data: Dict[str, Any]
    version: int
    created_at: datetime
    updated_at: datetime
    
    # Allow constructing the model directly from object attributes (SQLModel/ORM
    # instances) when using Pydantic v2. This lets callers do
    # `WorkflowDetail.model_validate(wf)` instead of manual field mapping.
    model_config = {"from_attributes": True}
