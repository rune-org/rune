from pydantic import BaseModel, Field
from typing import Any, Optional


class WorkflowNode(BaseModel):
    """Worker DSL node."""

    id: str
    name: str
    type: str  # ManualTrigger, http, smtp, conditional, switch
    trigger: bool = False
    parameters: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    position: tuple[int, int] = (0, 0)


class WorkflowEdge(BaseModel):
    """Worker DSL edge."""

    id: str
    src: str
    dst: str
    label: Optional[str] = None


class GenerateWorkflowRequest(BaseModel):
    """Request body for creating a workflow from natural language."""

    prompt: str


class ClearThreadResponse(BaseModel):
    """Response body for clearing a thread."""

    success: bool
    message: str
