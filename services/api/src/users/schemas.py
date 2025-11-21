from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from datetime import datetime
from typing import Optional
from src.db.models import UserRole
from src.auth.security import validate_password_strength


class UserCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=40)
    email: EmailStr
    role: UserRole = Field(
        default=UserRole.USER, description="User role: 'user' or 'admin'"
    )


class AdminUserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=40)
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=40)
    email: Optional[EmailStr] = None


class AdminPasswordResetResponse(BaseModel):
    temporary_password: str = Field(
        ..., description="Temporary password for the user to use"
    )
    user_id: int = Field(..., description="ID of the user whose password was reset")


class UserPasswordChange(BaseModel):
    old_password: str = Field(..., description="Current password for verification")
    new_password: str = Field(..., min_length=8, description="New password")

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        """Validate password strength according to security requirements."""
        is_valid, error_message = validate_password_strength(v)
        if not is_valid:
            raise ValueError(error_message)
        return v


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
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


class UserPasswordChangeResponse(BaseModel):
    user: UserResponse = Field(..., description="Updated user information")
    access_token: str = Field(
        ..., description="New access token with updated must_change_password flag"
    )
