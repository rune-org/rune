from typing import Any, Optional
from pydantic import BaseModel


class SIROutcome(BaseModel):
    """Represents where the flow goes next and why."""

    target_step_name: str
    label: str  # e.g., "Next Step", "If True", "On Error"
    description: Optional[str] = None  # e.g. "User is active"


class SIRStep(BaseModel):
    """A single step in the workflow."""

    id: str
    name: str
    type: str  # Raw node type from DSL
    credentials: Optional[str] = None

    # The simplified technical details (no noise)
    parameters: dict[str, Any]

    # Graph connections
    previous_step_name: Optional[str] = None
    outcomes: list[SIROutcome] = []


class SIRWorkflow(BaseModel):
    """The complete semantic representation of the workflow."""

    id: str
    name: str
    description: Optional[str]
    steps: list[SIRStep]
