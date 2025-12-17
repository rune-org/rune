import time
from typing import Any

from pydantic import BaseModel, Field


class NodeExecutionMessage(BaseModel):
    """Message to trigger workflow node execution."""

    workflow_id: str
    execution_id: str
    current_node: str
    workflow_definition: dict[str, Any]
    accumulated_context: dict[str, Any] = Field(default_factory=dict)


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
