from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from pydantic import BaseModel, field_validator
from sqlalchemy import Column
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlmodel import Field, SQLModel

from src.datetime_utils import UTCDateTime, ensure_utc, utc_now

# Inline minimal model to avoid importing from the API service.
# Must stay in sync with services/api/src/db/models.py Execution model.


class ExecutionStatus(str, PyEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    HALTED = "halted"


class Execution(SQLModel, table=True):
    __tablename__ = "executions"

    id: str = Field(primary_key=True)
    workflow_id: int = Field(foreign_key="workflows.id", ondelete="CASCADE", index=True)
    status: ExecutionStatus = Field(
        default=ExecutionStatus.PENDING,
        sa_column=Column(
            SQLAlchemyEnum(ExecutionStatus, name="execution_status", native_enum=True),
        ),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(UTCDateTime(), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(UTCDateTime(), nullable=False, onupdate=utc_now),
    )
    completed_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(UTCDateTime(), nullable=True),
    )
    total_duration_ms: Optional[int] = Field(default=None)
    failure_reason: Optional[str] = Field(default=None)


class CompletionMessage(BaseModel):
    workflow_id: str
    execution_id: str
    status: str
    final_context: dict
    completed_at: datetime
    total_duration_ms: int
    failure_reason: Optional[str] = None

    @field_validator("completed_at")
    @classmethod
    def normalize_completed_at(cls, v: datetime) -> datetime:
        return ensure_utc(v)
