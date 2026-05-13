"""Workflow validation module.

Combined validators for complete workflow data validation.
Integrates node, edge, and structure validation.
"""

from typing import Any

from src.workflow.validation.base import (
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

        Collects all structure errors and returns them together.

        Args:
            data: Workflow data to validate

        Returns:
            ValidationResult with any errors found
        """
        errors: list[ValidationError] = []

        if not isinstance(data, dict):
            errors.append(WorkflowDataNotObjectError())
            return ValidationResult.failure(errors)

        if not data:
            errors.append(WorkflowDataEmptyError())
            return ValidationResult.failure(errors)

        if "nodes" not in data:
            errors.append(WorkflowMissingNodesError())

        if "edges" not in data:
            errors.append(WorkflowMissingEdgesError())

        nodes = data.get("nodes")
        if not isinstance(nodes, list):
            errors.append(NodesNotArrayError())
        elif not nodes:
            errors.append(NodesEmptyError())

        edges = data.get("edges")
        if not isinstance(edges, list):
            errors.append(EdgesNotArrayError())

        if errors:
            return ValidationResult.failure(errors)

        if isinstance(nodes, list):
            trigger_nodes = [
                node
                for node in nodes
                if isinstance(node, dict) and node.get("trigger", False)
            ]
            if not trigger_nodes:
                errors.append(TriggerNodeMissingError())
            elif len(trigger_nodes) > 1:
                errors.append(TriggerNodeMultipleError())

        if errors:
            return ValidationResult.failure(errors)
        return ValidationResult.success()


class WorkflowValidator(Validator):
    """Complete workflow validator combining all validators.

    Runs:
    1. Structure validation (basic shape) - short-circuits on failure
    2. Node ID validation (node IDs, uniqueness)
    3. Edge wiring validation (edge connections)
    """

    def __init__(self):
        self.structure_validator = WorkflowStructureValidator()
        self.node_validator = NodeIdValidator()
        self.edge_validator = EdgeWiringValidator()

    def validate(self, data: dict[str, Any]) -> ValidationResult:
        """Run all validators, short-circuiting on structure failure."""
        structure_result = self.structure_validator.validate(data)
        if not structure_result.valid:
            return structure_result

        node_result = self.node_validator.validate(data)
        edge_result = self.edge_validator.validate(data)

        all_errors = list(node_result.errors) + list(edge_result.errors)
        if all_errors:
            return ValidationResult.failure(all_errors)
        return ValidationResult.success()


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
