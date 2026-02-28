from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from src.core.validators import validate_password_strength


class FirstAdminSignupRequest(BaseModel):
    """Request schema for first-time admin account creation."""

    model_config = ConfigDict(extra="forbid")

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
