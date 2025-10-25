from typing import Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field


class TemplateSummary(BaseModel):
    """Template summary for listing templates."""

    id: int
    name: str
    description: str
    category: str
    usage_count: int
    is_public: bool


class TemplateDetail(BaseModel):
    """Detailed template information including workflow data."""

    id: int
    name: str
    description: str
    category: str
    workflow_data: dict[str, Any]
    usage_count: int
    is_public: bool
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int]

    model_config = {"from_attributes": True}


class TemplateCreate(BaseModel):
    """Schema for creating a new template."""

    name: str = Field(..., min_length=1)
    description: str = Field(default="")
    category: str = Field(default="general")
    workflow_data: dict[str, Any] = Field(default_factory=dict)
    is_public: bool = Field(default=False)


class TemplateWorkflowData(BaseModel):
    """Schema for template workflow data response."""

    workflow_data: dict[str, Any]
