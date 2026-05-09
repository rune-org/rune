from pydantic import BaseModel, ConfigDict, Field

from src.core.field_types import UserEmail, UserPassword


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: UserEmail = Field(..., description="User's email address")
    password: UserPassword = Field(..., description="User's password")


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
