from typing import Optional, Dict, Any
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
    created_at: str
    updated_at: str
