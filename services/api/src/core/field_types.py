"""Reusable Pydantic field types for user-related request bodies."""

from typing import Annotated

from pydantic import BeforeValidator, EmailStr, Field

from src.core.validators import (
    validate_user_display_name,
    validate_password,
    validate_email,
)


UserDisplayName = Annotated[
    str,
    BeforeValidator(validate_user_display_name),
    Field(..., description="User display name"),
]


UserPassword = Annotated[
    str, BeforeValidator(validate_password), Field(..., description="User password")
]


UserEmail = Annotated[
    EmailStr, BeforeValidator(validate_email), Field(..., description="User email")
]
