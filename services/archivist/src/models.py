from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from pydantic import BaseModel, field_validator
from sqlalchemy import Column
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlmodel import Field, SQLModel

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
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(
        default_factory=datetime.now,
        sa_column_kwargs={"onupdate": datetime.now},
    )
    completed_at: Optional[datetime] = Field(default=None)
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

    # TODO: We should consider using a custom deserializer that can handle timezone-aware datetimes
    # and store them as UTC in the database, rather than stripping timezone info here.
    # This would allow us to preserve timezone information if needed in the future.
    @field_validator("completed_at")
    @classmethod
    def strip_timezone(cls, v: datetime) -> datetime:
        """Strip timezone info so the value is compatible with TIMESTAMP WITHOUT TIME ZONE columns."""
        if v.tzinfo is not None:
            return v.replace(tzinfo=None)
        return v
