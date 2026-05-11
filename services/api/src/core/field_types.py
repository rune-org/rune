"""Reusable Pydantic field types for user-related request bodies."""

from typing import Annotated

from pydantic import AfterValidator, EmailStr, Field

from src.core.validators import (
    validate_user_display_name,
    validate_password,
    validate_email,
)


UserDisplayName = Annotated[
    str,
    AfterValidator(validate_user_display_name),
    Field(..., min_length=3, max_length=40, description="User display name"),
]


UserPassword = Annotated[
    str,
    AfterValidator(validate_password),
    Field(..., min_length=8, max_length=128, description="User password"),
]


UserEmail = Annotated[
    EmailStr,
    AfterValidator(validate_email),
    Field(..., min_length=3, max_length=255, description="User email"),
]
