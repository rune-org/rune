from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from src.db.models import UserRole
from src.core.field_types import UserDisplayName, UserEmail, UserPassword


class UserCreate(BaseModel):
    name: UserDisplayName
    email: UserEmail
    role: UserRole = Field(
        default=UserRole.USER, description="User role: 'user' or 'admin'"
    )


class AdminUserUpdate(BaseModel):
    name: Optional[UserDisplayName] = None
    email: Optional[UserEmail] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserStatusUpdate(BaseModel):
    is_active: bool = Field(
        ..., description="Set to true to activate, false to deactivate"
    )


class ProfileUpdate(BaseModel):
    name: Optional[UserDisplayName] = None
    email: Optional[UserEmail] = None


class AdminPasswordResetResponse(BaseModel):
    temporary_password: str = Field(
        ..., description="Temporary password for the user to use"
    )
    user_id: int = Field(..., description="ID of the user whose password was reset")


class UserPasswordChange(BaseModel):
    old_password: UserPassword = Field(..., description="Current password for verification")
    new_password: UserPassword = Field(..., description="New password")


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: UserDisplayName
    email: UserEmail
    role: UserRole
    is_active: bool = Field(..., description="Account active status")
    created_at: datetime = Field(..., description="Account creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    last_login_at: Optional[datetime] = Field(None, description="Last login timestamp")
    must_change_password: bool = Field(
        ..., description="Flag indicating user must change password"
    )


class CreateUserResponse(BaseModel):
    user: UserResponse = Field(..., description="Newly created user")
    temporary_password: str = Field(
        ..., description="Temporary password for the user to use on first login"
    )


class UserBasicInfo(BaseModel):
    """Minimal user info for sharing purposes."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: UserDisplayName
    email: UserEmail
    role: UserRole
