import json
import uuid

from .prompts import NODE_SCHEMAS
from .schemas import WorkflowNode, WorkflowEdge


def _generate_id() -> str:
    """Generate a unique ID."""
    return str(uuid.uuid4())


def create_node(node_type: str, name: str, params: str | dict = "{}") -> str:
    """Create a workflow node.

    Args:
        node_type: trigger, http, smtp, conditional, or switch
        name: Node name (needs to be short, informative, without spaces)
        params: JSON object with node-specific parameters

    Returns:
        JSON with node_id and node object, or error if invalid.
    """
    node_type = node_type.lower().strip()

    # Map canvas types to worker types
    type_map = {
        "trigger": "ManualTrigger",
        "if": "conditional",
    }
    worker_type = type_map.get(node_type, node_type)
    schema_key = "trigger" if node_type == "trigger" else node_type
    if node_type == "conditional":
        schema_key = "if"

    if schema_key not in NODE_SCHEMAS:
        return json.dumps(
            {"error": f"Unknown type '{node_type}'. Valid: {list(NODE_SCHEMAS.keys())}"}
        )

    try:
        if isinstance(params, dict):
            parameters = params
        else:
            parameters = json.loads(params) if params else {}
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Invalid JSON: {e}"})

    # Validate fields against schema
    schema = NODE_SCHEMAS[schema_key]
    schema_fields = schema.get("fields", {})
    valid_field_names = set(schema_fields.keys())

    if valid_field_names:
        unknown = set(parameters.keys()) - valid_field_names
        if unknown:
            return json.dumps(
                {
                    "error": f"Unknown fields for {node_type}: {list(unknown)}",
                    "valid_fields": list(valid_field_names),
                },
                indent=2,
            )

        required = [
            f for f, desc in schema_fields.items() if "required" in str(desc).lower()
        ]
        missing = [f for f in required if f not in parameters]
        if missing:
            return json.dumps(
                {
                    "error": f"Missing required fields for {node_type}: {missing}",
                },
                indent=2,
            )

    node_id = _generate_id()
    is_trigger = node_type == "trigger"

    node = WorkflowNode(
        id=node_id,
        name=name,
        type=worker_type,
        trigger=is_trigger,
        parameters=parameters,
    )

    return json.dumps(
        {
            "node_id": node_id,
            "node": node.model_dump(exclude_none=True),
        },
        indent=2,
    )


def create_edge(src_id: str, dst_id: str, label: str = None) -> str:
    """Create an edge connecting two nodes.

    Args:
        src_id: Source node ID
        dst_id: Destination node ID
        label: For conditional nodes, use "true" or "false"

    Returns:
        JSON with edge_id and edge object.
    """
    edge_id = _generate_id()

    edge = WorkflowEdge(
        id=edge_id,
        src=src_id,
        dst=dst_id,
        label=label,
    )

    return json.dumps(
        {
            "edge_id": edge_id,
            "edge": edge.model_dump(exclude_none=True),
        },
        indent=2,
    )


def build_workflow(nodes_json: str, edges_json: str) -> str:
    """Assemble nodes and edges into a complete workflow.

    Args:
        nodes_json: JSON array of nodes (from create_node)
        edges_json: JSON array of edges (from create_edge)

    Returns:
        JSON workflow in worker DSL format, or error.
    """
    try:
        nodes_raw = json.loads(nodes_json)
        edges_raw = json.loads(edges_json)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Invalid JSON: {e}"})

    # Unwrap if needed
    nodes = [n.get("node", n) for n in nodes_raw]
    edges = [e.get("edge", e) for e in edges_raw]

    # Validate
    errors = _validate(nodes, edges)
    if errors:
        return json.dumps({"error": errors}, indent=2)

    return json.dumps(
        {
            "nodes": nodes,
            "edges": edges,
        },
        indent=2,
    )


def _validate(nodes: list, edges: list) -> list:
    """Validate workflow structure."""
    errors = []

    if not nodes:
        return ["No nodes provided"]

    # Check trigger
    triggers = [
        n for n in nodes if n.get("trigger") or n.get("type") == "ManualTrigger"
    ]
    if len(triggers) != 1:
        errors.append(f"Need exactly 1 trigger node, found {len(triggers)}")

    # Check edges reference valid nodes
    node_ids = {n["id"] for n in nodes}
    for e in edges:
        if e.get("src") not in node_ids:
            errors.append(f"Edge references missing source: {e.get('src')}")
        if e.get("dst") not in node_ids:
            errors.append(f"Edge references missing target: {e.get('dst')}")

    return errors


SMITH_TOOLS = [
    create_node,
    create_edge,
    build_workflow,
]
