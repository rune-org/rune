from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    workflow_data: dict[str, Any] = Field(...)
    is_public: bool = Field(default=False)

    model_config = ConfigDict(str_to_lower=False)

    @field_validator("is_public", mode="before")
    @classmethod
    def validate_is_public_strict(cls, v: Any) -> bool:
        """Validate that is_public is strictly a boolean, not a string."""
        if not isinstance(v, bool):
            raise ValueError(f"is_public must be a boolean, got {type(v).__name__}")
        return v

    @field_validator("workflow_data", mode="before")
    @classmethod
    def validate_workflow_data(cls, v: Any) -> dict[str, Any]:
        """Validate that workflow_data is not empty and is a valid dict."""
        if not isinstance(v, dict):
            raise ValueError("workflow_data must be a dictionary")

        if not v:
            raise ValueError("workflow_data cannot be empty")

        # Validate that all keys are strings
        for key in v.keys():
            if not isinstance(key, str):
                raise ValueError(
                    f"workflow_data keys must be strings, got {type(key).__name__}"
                )

        return v


class TemplateWorkflowData(BaseModel):
    """Schema for template workflow data response."""

    workflow_data: dict[str, Any]
