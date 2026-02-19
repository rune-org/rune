from typing import Any, Optional

from pydantic import BaseModel


class SIROutcome(BaseModel):
    """Represents where the flow goes next and why."""

    target_step_name: str
    label: str  # e.g., "Next Step", "If True", "On Error"


class SIRStep(BaseModel):
    """A single step in the workflow."""

    id: str
    name: str
    node_type: str  # Raw node type from DSL
    credentials: Optional[str] = None

    # The simplified technical details (no noise)
    node_config: dict[str, Any]

    # Graph connections
    parent_step_name: Optional[str] = None
    edges: list[SIROutcome] = []


class SIRWorkflow(BaseModel):
    """The complete semantic representation of the workflow."""

    id: str
    name: str
    description: Optional[str]
    steps: list[SIRStep]
