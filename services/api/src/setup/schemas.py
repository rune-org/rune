from pydantic import BaseModel, ConfigDict, Field, EmailStr

from src.core.field_types import UserDisplayName, UserEmail, UserPassword


class FirstAdminSignupRequest(BaseModel):
    """Request schema for first-time admin account creation."""

    model_config = ConfigDict(extra="forbid")

    name: UserDisplayName = Field(..., description="Admin's full name")
    email: UserEmail = Field(..., description="Admin's email address")
    password: UserPassword = Field(..., description="Admin's password")


class FirstAdminSignupResponse(BaseModel):
    """Response schema for successful first-time admin signup."""

    user_id: int = Field(..., description="ID of the newly created admin user")
    name: str = Field(..., description="Admin's name")
    email: EmailStr = Field(..., description="Admin's email")
