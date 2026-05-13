"""Edge/wiring validation module.

Validates edges/connections between nodes in workflow_data.
Handles validation for imported/copied workflows where edges may
reference non-existent nodes due to manual JSON editing.
"""

from typing import Any

from src.workflow.validation.base import (
    ValidationError,
    ValidationResult,
    Validator,
)


class EdgeSourceNodeNotFoundError(ValidationError):
    """Edge src references a non-existent node."""

    def __init__(self, edge_id: str | None, src_node_id: str):
        edge_id_str = f"'{edge_id}'" if edge_id else "edge"
        message = f"Wrong node '{src_node_id}' in edge {edge_id_str} src - node does not exist"
        super().__init__(
            message,
            field="edge.src",
            context={"edge_id": edge_id, "node_id": src_node_id},
        )
        self.edge_id = edge_id
        self.src_node_id = src_node_id


class EdgeDestinationNodeNotFoundError(ValidationError):
    """Edge dst references a non-existent node."""

    def __init__(self, edge_id: str | None, dst_node_id: str):
        edge_id_str = f"'{edge_id}'" if edge_id else "edge"
        message = f"Wrong node '{dst_node_id}' in edge {edge_id_str} dst - node does not exist"
        super().__init__(
            message,
            field="edge.dst",
            context={"edge_id": edge_id, "node_id": dst_node_id},
        )
        self.edge_id = edge_id
        self.dst_node_id = dst_node_id


class SelfReferencingEdgeError(ValidationError):
    """Edge connects a node to itself."""

    def __init__(self, edge_id: str | None, node_id: str):
        edge_id_str = f"'{edge_id}'" if edge_id else "edge"
        message = (
            f"Self-referencing edge {edge_id_str} connects node '{node_id}' to itself"
        )
        super().__init__(
            message,
            field="edge.src/dst",
            context={"edge_id": edge_id, "node_id": node_id},
        )
        self.edge_id = edge_id
        self.node_id = node_id


class EdgeMissingSourceError(ValidationError):
    """Edge is missing required src field."""

    def __init__(self, edge_id: str | None, index: int):
        edge_id_str = f"'{edge_id}'" if edge_id else f"at index {index}"
        message = f"Edge {edge_id_str} is missing required 'src' field"
        super().__init__(
            message, field="edge.src", context={"edge_id": edge_id, "index": index}
        )


class EdgeMissingDestinationError(ValidationError):
    """Edge is missing required dst field."""

    def __init__(self, edge_id: str | None, index: int):
        edge_id_str = f"'{edge_id}'" if edge_id else f"at index {index}"
        message = f"Edge {edge_id_str} is missing required 'dst' field"
        super().__init__(
            message, field="edge.dst", context={"edge_id": edge_id, "index": index}
        )


class EdgeInvalidSourceTypeError(ValidationError):
    """Edge src field is not a valid string."""

    def __init__(self, edge_id: str | None, index: int, actual_type: str):
        edge_id_str = f"'{edge_id}'" if edge_id else f"at index {index}"
        message = f"Edge {edge_id_str} 'src' must be a string, got {actual_type}"
        super().__init__(
            message,
            field="edge.src",
            context={"edge_id": edge_id, "index": index, "type": actual_type},
        )


class EdgeInvalidDestinationTypeError(ValidationError):
    """Edge dst field is not a valid string."""

    def __init__(self, edge_id: str | None, index: int, actual_type: str):
        edge_id_str = f"'{edge_id}'" if edge_id else f"at index {index}"
        message = f"Edge {edge_id_str} 'dst' must be a string, got {actual_type}"
        super().__init__(
            message,
            field="edge.dst",
            context={"edge_id": edge_id, "index": index, "type": actual_type},
        )


class EdgeWiringValidator(Validator):
    """Validator for edge wiring/connections in workflow data.

    Validates:
    - Edge src/dst fields exist and are strings
    - Edge src/dst reference valid node IDs
    - No self-referencing edges
    """

    def validate(self, data: dict[str, Any]) -> ValidationResult:
        """Validate edge wiring in workflow data.

        Args:
            data: Workflow data dict with 'nodes' and 'edges' keys

        Returns:
            ValidationResult with any errors found
        """
        errors: list[ValidationError] = []

        nodes = data.get("nodes", [])
        edges = data.get("edges", [])

        node_ids: set[str] = self._extract_node_ids(nodes)
        edge_errors = self._validate_edges(edges, node_ids)
        errors.extend(edge_errors)

        if errors:
            return ValidationResult.failure(errors)
        return ValidationResult.success()

    def _extract_node_ids(self, nodes: list[Any]) -> set[str]:
        """Extract valid node IDs from nodes list."""
        node_ids: set[str] = set()
        for node in nodes:
            if isinstance(node, dict) and "id" in node:
                node_id = node.get("id")
                if isinstance(node_id, str):
                    node_ids.add(node_id)
        return node_ids

    def _validate_edges(
        self,
        edges: list[Any],
        node_ids: set[str],
    ) -> list[ValidationError]:
        """Validate all edges reference valid nodes."""
        errors: list[ValidationError] = []

        for idx, edge in enumerate(edges):
            if not isinstance(edge, dict):
                continue

            edge_id = edge.get("id")
            src = edge.get("src")
            dst = edge.get("dst")

            src_error = self._validate_edge_endpoint(
                edge_id, idx, src, node_ids, is_src=True
            )
            if src_error:
                errors.append(src_error)

            dst_error = self._validate_edge_endpoint(
                edge_id, idx, dst, node_ids, is_src=False
            )
            if dst_error:
                errors.append(dst_error)

            if (
                src is not None
                and dst is not None
                and isinstance(src, str)
                and isinstance(dst, str)
                and src == dst
                and src in node_ids
            ):
                errors.append(SelfReferencingEdgeError(edge_id, src))

        return errors

    def _validate_edge_endpoint(
        self,
        edge_id: str | None,
        index: int,
        value: Any,
        node_ids: set[str],
        is_src: bool,
    ) -> ValidationError | None:
        """Validate a single edge endpoint (src or dst)."""
        if is_src:
            if value is None:
                return EdgeMissingSourceError(edge_id, index)
            if not isinstance(value, str):
                return EdgeInvalidSourceTypeError(edge_id, index, type(value).__name__)
            if value not in node_ids:
                return EdgeSourceNodeNotFoundError(edge_id, value)
        else:
            if value is None:
                return EdgeMissingDestinationError(edge_id, index)
            if not isinstance(value, str):
                return EdgeInvalidDestinationTypeError(
                    edge_id, index, type(value).__name__
                )
            if value not in node_ids:
                return EdgeDestinationNodeNotFoundError(edge_id, value)

        return None


def validate_edge_references(
    edges: list[dict[str, Any]], node_ids: set[str]
) -> list[ValidationError]:
    """Validate edges reference valid node IDs.

    Args:
        edges: List of edge dictionaries
        node_ids: Set of valid node IDs

    Returns:
        List of validation errors
    """
    validator = EdgeWiringValidator()
    workflow_data = {"nodes": [], "edges": edges}
    result = validator.validate(workflow_data)
    return result.errors


def validate_no_self_referencing_edges(
    edges: list[dict[str, Any]], node_ids: set[str]
) -> list[ValidationError]:
    """Validate no edges connect a node to itself.

    Args:
        edges: List of edge dictionaries
        node_ids: Set of valid node IDs

    Returns:
        List of validation errors
    """
    errors: list[ValidationError] = []

    for edge in edges:
        if not isinstance(edge, dict):
            continue

        edge_id = edge.get("id")
        src = edge.get("src")
        dst = edge.get("dst")

        if (
            src is not None
            and dst is not None
            and isinstance(src, str)
            and isinstance(dst, str)
            and src == dst
            and src in node_ids
        ):
            errors.append(SelfReferencingEdgeError(edge_id, src))

    return errors
