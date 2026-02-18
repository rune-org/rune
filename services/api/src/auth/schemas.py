from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from src.core.validators import validate_password_strength


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., min_length=1, description="User's password")


class TokenResponse(BaseModel):
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(
        ..., description="Refresh token for obtaining new access tokens"
    )
    token_type: str = Field(default="bearer", description="Token type, always 'bearer'")
    expires_in: int = Field(..., description="Access token expiration time in seconds")


class RefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_token: str = Field(..., min_length=1, description="Valid refresh token")


class FirstAdminSignupRequest(BaseModel):
    """Request schema for first-time admin account creation."""

    name: str = Field(..., min_length=3, max_length=40, description="Admin's full name")
    email: EmailStr = Field(..., description="Admin's email address")
    password: str = Field(..., min_length=8, description="Admin's password")

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength according to security requirements."""
        is_valid, error_message = validate_password_strength(v)
        if not is_valid:
            raise ValueError(error_message)
        return v


class FirstAdminSignupResponse(BaseModel):
    """Response schema for successful first-time admin signup."""

    user_id: int = Field(..., description="ID of the newly created admin user")
    name: str = Field(..., description="Admin's name")
    email: EmailStr = Field(..., description="Admin's email")


class FirstTimeSetupStatus(BaseModel):
    """Response schema for first-time setup status check."""

    requires_setup: bool = Field(
        ..., description="Whether the system requires first-time admin setup"
    )
    message: str = Field(..., description="Status message")
