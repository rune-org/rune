import time
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from src.db.models import ExecutionStatus


class ExecutionTokenMessage(BaseModel):
    """
    Execution token for RTES authentication.

    This token is published to the execution.token queue and allows
    the frontend to authenticate with RTES for real-time execution updates.

    If execution_id is None, the token grants access to all executions
    for the given workflow (wildcard access).
    """

    execution_id: str | None = None  # None = wildcard access to all executions
    workflow_id: str
    user_id: str
    iat: int = Field(default_factory=lambda: int(time.time()))
    exp: int = Field(default_factory=lambda: int(time.time()) + 3600)  # 1 hour TTL


class ExecutionListItem(BaseModel):
    id: str
    workflow_id: int
    workflow_name: str
    status: ExecutionStatus
    created_at: datetime
    completed_at: Optional[datetime] = None
    total_duration_ms: Optional[int] = None
    failure_reason: Optional[str] = None

    model_config = {"from_attributes": True}
