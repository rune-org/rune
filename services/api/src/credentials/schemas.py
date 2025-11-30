from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field

from src.db.models import CredentialType


class CredentialCreate(BaseModel):
    """Schema for creating a new credential."""

    name: str = Field(..., min_length=1, max_length=100, description="Credential name")
    credential_type: CredentialType = Field(..., description="Type of credential")
    credential_data: dict[str, Any] = Field(
        default_factory=dict, description="Credential data (will be encrypted)"
    )


class CredentialUpdate(BaseModel):
    """Schema for updating a credential."""

    name: Optional[str] = Field(
        None, min_length=1, max_length=100, description="Credential name"
    )
    credential_type: Optional[CredentialType] = Field(
        None, description="Type of credential"
    )
    credential_data: Optional[dict[str, Any]] = Field(
        None, description="Credential data (will be encrypted)"
    )


class CredentialShare(BaseModel):
    """Schema for sharing a credential with a user."""

    user_id: int = Field(..., description="ID of user to share with")


class CredentialShareInfo(BaseModel):
    """Information about a credential share."""

    model_config = {"from_attributes": True}

    user_id: int
    user_email: str
    user_name: str
    shared_at: datetime
    shared_by: Optional[int]


class CredentialResponse(BaseModel):
    """Schema for credential response (without sensitive data)."""

    model_config = {"from_attributes": True}

    id: int
    name: str
    credential_type: CredentialType
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    is_owner: bool = Field(
        default=False,
        description="Whether current user is the owner of this credential",
    )
    can_share: bool = Field(
        default=False, description="Whether current user can share this credential"
    )
    can_edit: bool = Field(
        default=False, description="Whether current user can edit this credential"
    )
    can_delete: bool = Field(
        default=False, description="Whether current user can delete this credential"
    )


class CredentialResponseDropDown(BaseModel):
    """Schema for credential response in dropdowns."""

    model_config = {"from_attributes": True}

    id: int
    name: str
    credential_type: CredentialType
