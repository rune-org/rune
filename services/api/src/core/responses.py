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


class PaginatedData(BaseModel, Generic[DataT]):
    """Generic model for paginated data response."""

    items: list[DataT] = Field(..., description="Paginated items")
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Items per page")
    total_pages: int = Field(..., description="Total pages")
