"""Node ID validation module.

Validates node IDs and structure in workflow data.
Ensures nodes have required fields and unique IDs.
"""

from typing import Any

from src.workflow.validation.base import (
    ValidationError,
    ValidationResult,
    Validator,
)


class NodeMissingIdError(ValidationError):
    """Node is missing required id field."""

    def __init__(self, index: int):
        message = f"Node at index {index} must have 'id' field"
        super().__init__(message, field="node.id", context={"index": index})
        self.index = index


class NodeEmptyIdError(ValidationError):
    """Node has empty id field."""

    def __init__(self, index: int):
        message = f"Node at index {index} has empty 'id'"
        super().__init__(message, field="node.id", context={"index": index})
        self.index = index


class NodeDuplicateIdError(ValidationError):
    """Node has duplicate id."""

    def __init__(self, node_id: str):
        message = f"Duplicate node id '{node_id}'"
        super().__init__(message, field="node.id", context={"node_id": node_id})
        self.node_id = node_id


class NodeMissingTypeError(ValidationError):
    """Node is missing required type field."""

    def __init__(self, index: int):
        message = f"Node at index {index} must have 'type' field"
        super().__init__(message, field="node.type", context={"index": index})
        self.index = index


class NodeNotObjectError(ValidationError):
    """Node is not a valid object."""

    def __init__(self, index: int):
        message = f"Node at index {index} must be an object"
        super().__init__(message, field="node", context={"index": index})
        self.index = index


class NodeIdValidator(Validator):
    """Validator for node IDs and structure.

    Validates:
    - Nodes are objects (dicts)
    - Nodes have required 'id' field
    - Node IDs are non-empty strings
    - Node IDs are unique
    - Nodes have 'type' field
    """

    def validate(self, data: dict[str, Any]) -> ValidationResult:
        """Validate node IDs in workflow data.

        Args:
            data: Workflow data dict with 'nodes' key

        Returns:
            ValidationResult with any errors found
        """
        errors: list[ValidationError] = []

        nodes = data.get("nodes", [])
        seen_ids: set[str] = set()

        for i, node in enumerate(nodes):
            node_error = self._validate_node(node, i, seen_ids)
            if node_error:
                errors.append(node_error)

        if errors:
            return ValidationResult.failure(errors)
        return ValidationResult.success()

    def _validate_node(
        self,
        node: Any,
        index: int,
        seen_ids: set[str],
    ) -> ValidationError | None:
        """Validate a single node."""
        if not isinstance(node, dict):
            return NodeNotObjectError(index)

        if "id" not in node:
            return NodeMissingIdError(index)

        node_id = node.get("id")
        if not node_id:
            return NodeEmptyIdError(index)

        if node_id in seen_ids:
            return NodeDuplicateIdError(node_id)
        seen_ids.add(node_id)

        if "type" not in node:
            return NodeMissingTypeError(index)

        return None


def validate_node_ids(nodes: list[dict[str, Any]]) -> list[ValidationError]:
    """Validate node IDs in nodes list.

    Args:
        nodes: List of node dictionaries

    Returns:
        List of validation errors
    """
    validator = NodeIdValidator()
    workflow_data = {"nodes": nodes, "edges": []}
    result = validator.validate(workflow_data)
    return result.errors
