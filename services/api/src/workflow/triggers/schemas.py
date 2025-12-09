"""Schemas for workflow trigger operations."""

from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class ScheduleInfo(BaseModel):
    """Minimal schedule info for workflow list and detail views."""

    id: int
    interval_seconds: int
    next_run_at: datetime
    last_run_at: datetime | None
    is_active: bool
    run_count: int
    failure_count: int
    last_error: str | None

    model_config = {"from_attributes": True}


class ScheduleCreate(BaseModel):
    """Schema for creating a new schedule trigger."""

    interval_seconds: int = Field(
        gt=0,
        description="Interval in seconds between executions (e.g., 60 for 1 min, 3600 for 1h, 86400 for 1d)",
    )
    start_at: datetime | None = Field(
        default=None,
        description="When to start the schedule (defaults to now)",
    )
    is_active: bool = Field(
        default=True, description="Whether the schedule is active immediately"
    )

    @field_validator("interval_seconds")
    @classmethod
    def validate_interval_seconds(cls, v: int) -> int:
        """Validate interval_seconds has reasonable bounds."""
        if v <= 0:
            raise ValueError("interval_seconds must be positive")
        if v > 31536000:  # 365 days in seconds
            raise ValueError("interval_seconds cannot exceed 31536000 (1 year)")
        return v


class ScheduleUpdate(BaseModel):
    """Schema for updating an existing schedule trigger."""

    interval_seconds: int | None = Field(default=None, gt=0)
    start_at: datetime | None = None
    is_active: bool | None = None

    @field_validator("interval_seconds")
    @classmethod
    def validate_interval_seconds(cls, v: int | None) -> int | None:
        """Validate interval_seconds has reasonable bounds."""
        if v is not None:
            if v <= 0:
                raise ValueError("interval_seconds must be positive")
            if v > 31536000:  # 365 days in seconds
                raise ValueError("interval_seconds cannot exceed 31536000 (1 year)")
        return v


class ScheduleDetail(BaseModel):
    """Schema for detailed schedule information."""

    id: int
    workflow_id: int
    is_active: bool
    interval_seconds: int
    start_at: datetime
    next_run_at: datetime
    last_run_at: datetime | None
    run_count: int
    failure_count: int
    last_error: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
