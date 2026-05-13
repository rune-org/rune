"""Workflow validation module.

Combined validators for complete workflow data validation.
Integrates node, edge, and structure validation.
"""

from typing import Any

from src.workflow.validation.base import (
    CompositeValidator,
    ValidationError,
    ValidationResult,
    Validator,
)
from src.workflow.validation.edge import EdgeWiringValidator
from src.workflow.validation.node import NodeIdValidator


class WorkflowStructureError(ValidationError):
    """Workflow structure is invalid."""

    def __init__(self, message: str, field: str | None = None):
        super().__init__(message, field=field)
        self.message = message


class WorkflowDataNotObjectError(WorkflowStructureError):
    """Workflow data is not a dict/object."""

    def __init__(self):
        super().__init__("workflow_data must be an object", field="workflow_data")


class WorkflowDataEmptyError(WorkflowStructureError):
    """Workflow data is empty."""

    def __init__(self):
        super().__init__("workflow_data cannot be empty", field="workflow_data")


class WorkflowMissingNodesError(WorkflowStructureError):
    """Workflow data is missing nodes field."""

    def __init__(self):
        super().__init__("workflow_data must contain 'nodes' field", field="nodes")


class WorkflowMissingEdgesError(WorkflowStructureError):
    """Workflow data is missing edges field."""

    def __init__(self):
        super().__init__("workflow_data must contain 'edges' field", field="edges")


class NodesNotArrayError(WorkflowStructureError):
    """Nodes field is not an array."""

    def __init__(self):
        super().__init__("'nodes' must be an array", field="nodes")


class EdgesNotArrayError(WorkflowStructureError):
    """Edges field is not an array."""

    def __init__(self):
        super().__init__("'edges' must be an array", field="edges")


class NodesEmptyError(WorkflowStructureError):
    """Nodes array is empty."""

    def __init__(self):
        super().__init__("'nodes' array cannot be empty", field="nodes")


class TriggerNodeMissingError(WorkflowStructureError):
    """Workflow has no trigger node."""

    def __init__(self):
        super().__init__(
            "Workflow must have at least one trigger node", field="trigger"
        )


class TriggerNodeMultipleError(WorkflowStructureError):
    """Workflow has multiple trigger nodes."""

    def __init__(self):
        super().__init__("Workflow must have exactly one trigger node", field="trigger")


class WorkflowStructureValidator(Validator):
    """Validator for high-level workflow structure.

    Validates:
    - workflow_data is a dict
    - workflow_data has nodes and edges
    - nodes and edges are arrays
    - nodes array is not empty
    - Exactly one trigger node exists
    """

    def validate(self, data: dict[str, Any]) -> ValidationResult:
        """Validate workflow structure.

        Args:
            data: Workflow data to validate

        Returns:
            ValidationResult with any errors found
        """
        errors: list[ValidationError] = []

        if not isinstance(data, dict):
            return ValidationResult.failure_from_single(WorkflowDataNotObjectError())

        if not data:
            return ValidationResult.failure_from_single(WorkflowDataEmptyError())

        if "nodes" not in data:
            return ValidationResult.failure_from_single(WorkflowMissingNodesError())

        if "edges" not in data:
            return ValidationResult.failure_from_single(WorkflowMissingEdgesError())

        nodes = data.get("nodes")
        if not isinstance(nodes, list):
            return ValidationResult.failure_from_single(NodesNotArrayError())

        edges = data.get("edges")
        if not isinstance(edges, list):
            return ValidationResult.failure_from_single(EdgesNotArrayError())

        if not nodes:
            return ValidationResult.failure_from_single(NodesEmptyError())

        trigger_nodes = [
            node
            for node in nodes
            if isinstance(node, dict) and node.get("trigger", False)
        ]
        if not trigger_nodes:
            return ValidationResult.failure_from_single(TriggerNodeMissingError())

        if len(trigger_nodes) > 1:
            return ValidationResult.failure_from_single(TriggerNodeMultipleError())

        return ValidationResult.success()


class WorkflowValidator(CompositeValidator):
    """Complete workflow validator combining all validators.

    Runs:
    1. Structure validation (basic shape)
    2. Node ID validation (node IDs, uniqueness)
    3. Edge wiring validation (edge connections)
    """

    def __init__(self):
        super().__init__(
            [
                WorkflowStructureValidator(),
                NodeIdValidator(),
                EdgeWiringValidator(),
            ]
        )


def validate_workflow_structure(data: dict[str, Any]) -> ValidationResult:
    """Validate high-level workflow structure.

    Args:
        data: Workflow data to validate

    Returns:
        ValidationResult with any errors
    """
    validator = WorkflowStructureValidator()
    return validator.validate(data)


def validate_workflow_wiring(data: dict[str, Any]) -> list[ValidationError]:
    """Validate edge wiring/connections in workflow.

    Args:
        data: Workflow data to validate

    Returns:
        List of validation errors (empty if valid)
    """
    validator = EdgeWiringValidator()
    result = validator.validate(data)
    return result.errors


def validate_workflow_data(data: dict[str, Any]) -> ValidationResult:
    """Validate complete workflow data.

    Args:
        data: Workflow data to validate

    Returns:
        ValidationResult with any errors
    """
    validator = WorkflowValidator()
    return validator.validate(data)
