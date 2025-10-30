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


class CredentialResponse(BaseModel):
    """Schema for credential response (without sensitive data)."""

    model_config = {"from_attributes": True}

    id: int
    name: str
    credential_type: CredentialType
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime


class CredentialResponseDropDown(BaseModel):
    """Schema for credential response in dropdowns."""

    model_config = {"from_attributes": True}

    id: int
    name: str
    credential_type: CredentialType
