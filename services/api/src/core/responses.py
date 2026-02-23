"""
Response models and utilities for consistent API responses.
"""

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

DataT = TypeVar("DataT")


class ApiResponse(BaseModel, Generic[DataT]):
    """Base API response model for all responses."""

    success: bool = Field(
        default=True, description="Whether the request was successful"
    )
    message: str = Field(default="Success", description="Human-readable message")
    data: DataT = Field(..., description="Response data")
