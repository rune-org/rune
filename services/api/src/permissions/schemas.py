"""
Pydantic schemas for workflow permissions and sharing.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

from src.db.models import WorkflowRole


class WorkflowShareRequest(BaseModel):
    """Request to share a workflow with another user."""

    user_id: int = Field(..., description="ID of the user to share with")
    role: WorkflowRole = Field(
        ...,
        description="Role to grant (EDITOR or VIEWER, not OWNER)",
    )

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: WorkflowRole) -> WorkflowRole:
        """Ensure only EDITOR or VIEWER roles can be granted via sharing."""
        if v == WorkflowRole.OWNER:
            raise ValueError("Cannot grant OWNER role through sharing")
        return v


class WorkflowShareResponse(BaseModel):
    """Response after sharing a workflow."""

    status: str = "success"
    message: str


class WorkflowPermissionInfo(BaseModel):
    """Information about a user's permission on a workflow."""

    user_id: int
    user_email: str
    user_name: str
    role: WorkflowRole
    granted_at: datetime
    granted_by: Optional[int] = None


class WorkflowPermissionListResponse(BaseModel):
    """List of all users with access to a workflow."""

    workflow_id: int
    permissions: list[WorkflowPermissionInfo]
