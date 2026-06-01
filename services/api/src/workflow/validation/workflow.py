"""Workflow semantic validation.

Top-level semantic validation for a workflow graph. Shape (required/non-empty
fields, types, id uniqueness, non-empty nodes) is enforced upstream by the
``RuntimeWorkflowGraph`` Pydantic model in ``src/workflow/schemas.py``; this
module only validates cross-field semantics:
- exactly one trigger node
- edge wiring (endpoints reference existing nodes, no self-references)
"""

from typing import Any

from src.workflow.validation.base import ValidationError, ValidationResult
from src.workflow.validation.edge import validate_edge_wiring


class TriggerNodeMissingError(ValidationError):
    """Workflow has no trigger node."""

    def __init__(self):
        super().__init__(
            "Workflow must have at least one trigger node", field="trigger"
        )


class TriggerNodeMultipleError(ValidationError):
    """Workflow has multiple trigger nodes."""

    def __init__(self):
        super().__init__("Workflow must have exactly one trigger node", field="trigger")


def validate_trigger_nodes(data: dict[str, Any]) -> list[ValidationError]:
    """Validate that a workflow has exactly one trigger node."""
    trigger_count = sum(
        1 for node in data.get("nodes", []) if node.get("trigger", False)
    )
    if trigger_count == 0:
        return [TriggerNodeMissingError()]
    if trigger_count > 1:
        return [TriggerNodeMultipleError()]
    return []


def validate_workflow_data(data: dict[str, Any]) -> ValidationResult:
    """Validate workflow semantics (trigger count + edge wiring).

    Args:
        data: Shape-validated workflow data (nodes + edges)

    Returns:
        ValidationResult with any errors
    """
    errors = validate_trigger_nodes(data) + validate_edge_wiring(data)
    return ValidationResult(valid=not errors, errors=errors)
