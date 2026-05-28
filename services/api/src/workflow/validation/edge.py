"""Edge/wiring validation.

Semantic validation of edges/connections between nodes. Runs *after* Pydantic
shape validation (``RuntimeWorkflowGraph``), so ``src``/``dst`` are guaranteed
to be present, non-empty strings; this layer only checks cross-field rules
Pydantic cannot express:
- edge ``src``/``dst`` reference existing node ids
- no self-referencing edges
"""

from typing import Any

from src.workflow.validation.base import ValidationError


class EdgeSourceNodeNotFoundError(ValidationError):
    """Edge src references a non-existent node."""

    def __init__(self, edge_id: str | None, src_node_id: str):
        edge_id_str = f"'{edge_id}'" if edge_id else "edge"
        super().__init__(
            f"Edge {edge_id_str} src references unknown node '{src_node_id}'",
            field="edge.src",
            context={"edge_id": edge_id, "node_id": src_node_id},
        )


class EdgeDestinationNodeNotFoundError(ValidationError):
    """Edge dst references a non-existent node."""

    def __init__(self, edge_id: str | None, dst_node_id: str):
        edge_id_str = f"'{edge_id}'" if edge_id else "edge"
        super().__init__(
            f"Edge {edge_id_str} dst references unknown node '{dst_node_id}'",
            field="edge.dst",
            context={"edge_id": edge_id, "node_id": dst_node_id},
        )


class SelfReferencingEdgeError(ValidationError):
    """Edge connects a node to itself."""

    def __init__(self, edge_id: str | None, node_id: str):
        edge_id_str = f"'{edge_id}'" if edge_id else "edge"
        super().__init__(
            f"Self-referencing edge {edge_id_str} connects node '{node_id}' to itself",
            field="edge.src/dst",
            context={"edge_id": edge_id, "node_id": node_id},
        )


def validate_edge_wiring(data: dict[str, Any]) -> list[ValidationError]:
    """Validate edge endpoints reference existing nodes and aren't self-loops.

    Args:
        data: Workflow data (already shape-validated by ``RuntimeWorkflowGraph``)

    Returns:
        List of validation errors (empty if valid)
    """
    node_ids = {node["id"] for node in data.get("nodes", [])}
    errors: list[ValidationError] = []

    for edge in data.get("edges", []):
        edge_id = edge.get("id")
        src = edge.get("src")
        dst = edge.get("dst")

        if src not in node_ids:
            errors.append(EdgeSourceNodeNotFoundError(edge_id, src))
        if dst not in node_ids:
            errors.append(EdgeDestinationNodeNotFoundError(edge_id, dst))
        if src == dst and src in node_ids:
            errors.append(SelfReferencingEdgeError(edge_id, src))

    return errors
