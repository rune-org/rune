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
    position: Optional[tuple[int, int]] = None


class WorkflowEdge(BaseModel):
    """Worker DSL edge."""
    id: str
    src: str
    dst: str
    label: Optional[str] = None


class Workflow(BaseModel):
    """Complete workflow in worker DSL format."""
    nodes: list[WorkflowNode] = Field(default_factory=list)
    edges: list[WorkflowEdge] = Field(default_factory=list)
