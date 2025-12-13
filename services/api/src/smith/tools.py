import json
import uuid
from typing import Literal

from langchain.tools import tool
from pydantic import BaseModel, Field

from .prompts import NODE_SCHEMAS
from .schemas import WorkflowNode, WorkflowEdge


class CreateNodeArgs(BaseModel):
    """Arguments for creating a workflow node."""

    node_type: Literal["trigger", "http", "smtp", "conditional", "switch"] = Field(
        ..., description="Node type: trigger, http, smtp, conditional, or switch"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    parameters: str | dict = Field(
        default_factory=dict, description="JSON object with node-specific parameters"
    )


class CreateEdgeArgs(BaseModel):
    """Arguments for creating an edge connecting two nodes."""

    src_id: str = Field(..., description="Source node ID")
    dst_id: str = Field(..., description="Destination node ID")
    label: Literal["true", "false"] | None = Field(
        default=None, description="For conditional nodes, use 'true' or 'false'"
    )


class BuildWorkflowArgs(BaseModel):
    """Arguments for assembling nodes and edges into a complete workflow."""

    nodes_json: str = Field(..., description="JSON array of nodes (from create_node)")
    edges_json: str = Field(..., description="JSON array of edges (from create_edge)")


def _generate_id() -> str:
    """Generate a unique ID."""
    return str(uuid.uuid4())


@tool(
    args_schema=CreateNodeArgs,
    description="Create a workflow node with specified type, name, and parameters. Returns JSON with node_id and node object, or error if invalid.",
)
def create_node(
    node_type: Literal["trigger", "http", "smtp", "conditional", "switch"],
    name: str,
    parameters: str | dict = None,
) -> str:
    if parameters is None:
        parameters = {}

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
        if isinstance(parameters, dict):
            params_dict = parameters
        else:
            params_dict = json.loads(parameters) if parameters else {}
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Invalid JSON: {e}"})

    # Validate fields against schema
    schema = NODE_SCHEMAS[schema_key]
    schema_fields = schema.get("fields", {})
    valid_field_names = set(schema_fields.keys())

    if valid_field_names:
        unknown = set(params_dict.keys()) - valid_field_names
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
        missing = [f for f in required if f not in params_dict]
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
        parameters=params_dict,
    )

    return json.dumps(
        {
            "node_id": node_id,
            "node": node.model_dump(exclude_none=True),
        },
        indent=2,
    )


@tool(
    args_schema=CreateEdgeArgs,
    description="Create an edge connecting two nodes. Returns JSON with edge_id and edge object.",
)
def create_edge(
    src_id: str, dst_id: str, label: Literal["true", "false"] | None = None
) -> str:
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


@tool(
    args_schema=BuildWorkflowArgs,
    description="Assemble nodes and edges into a complete workflow. Returns JSON workflow in worker DSL format, or error.",
)
def build_workflow(nodes_json: str, edges_json: str) -> str:
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
