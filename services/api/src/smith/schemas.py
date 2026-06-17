from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class TodoItem(BaseModel):
    """A single todo item in Smith's planning list."""

    id: str
    title: str
    status: Literal["pending", "in_progress", "done"] = "pending"
    description: Optional[str] = None


class WorkflowNode(BaseModel):
    """Worker DSL node."""

    id: str
    name: str
    type: str  # trigger, scheduledTrigger, http, smtp, log, if, switch, merge, edit, filter, sort, limit, split, aggregator, wait, datetime
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
    """Request body for creating or editing a workflow from natural language.

    ``nodes``/``edges`` carry the **live canvas graph** the user is looking at
    (worker-DSL form, as produced by the frontend's ``canvasToWorkflowData``).
    Smith seeds its state from these so it edits exactly what is on screen — an
    empty graph means "build from scratch". They are kept as loose dicts (not
    ``WorkflowNode``/``WorkflowEdge``) so canvas-only fields like ``position``
    pass through untouched; ``_normalize_node_types`` consumes them directly.
    """

    prompt: str
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)


class ClearThreadResponse(BaseModel):
    """Response body for clearing a thread."""

    success: bool
    message: str
