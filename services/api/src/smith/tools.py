import json
import uuid

from langchain.tools import ToolRuntime, tool
from langchain_core.messages import ToolMessage
from langgraph.types import Command

from .nodes import (
    ConditionalArgs,
    HTTPArgs,
    SMTPArgs,
    SwitchArgs,
    TriggerArgs,
)
from .schemas import WorkflowEdge, WorkflowNode


def _create_node_from_args(args, runtime: ToolRuntime) -> Command:
    """Helper to extract params and build a workflow node from any Args model."""
    node_type = args.node_type
    name = args.name
    params = args.model_dump(
        exclude={"node_type", "name"}, exclude_none=True, by_alias=True
    )

    # Parse JSON strings for HTTP node fields
    if "headers" in params and isinstance(params["headers"], str):
        try:
            params["headers"] = json.loads(params["headers"])
        except json.JSONDecodeError:
            pass  # Keep as string if not valid JSON

    if "query" in params and isinstance(params["query"], str):
        try:
            params["query"] = json.loads(params["query"])
        except json.JSONDecodeError:
            pass  # Keep as string if not valid JSON

    if "body" in params and isinstance(params["body"], str):
        try:
            params["body"] = json.loads(params["body"])
        except json.JSONDecodeError:
            pass  # Keep as string if not valid JSON (could be plain text)

    node_id = str(uuid.uuid4())
    is_trigger = node_type == "ManualTrigger"

    node = WorkflowNode(
        id=node_id,
        name=name,
        type=node_type,
        trigger=is_trigger,
        parameters=params,
    )

    node_dict = node.model_dump(exclude_none=True)

    # Get current nodes from state and append new node
    workflow_nodes = runtime.state.get("workflow_nodes", [])
    updated_nodes = workflow_nodes + [node_dict]

    # Create ToolMessage with the result
    tool_message = ToolMessage(
        content=json.dumps({"node_id": node_id, "node": node_dict}),
        tool_call_id=runtime.tool_call_id,
    )

    # Return Command to update state with messages
    return Command(
        update={
            "workflow_nodes": updated_nodes,
            "messages": [tool_message],
        },
    )


@tool(
    args_schema=TriggerArgs,
    description="Create a trigger node (workflow entry point). No parameters needed. Automatically adds to workflow state.",
)
def create_trigger_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a trigger node and add it to the workflow state."""
    args = TriggerArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=HTTPArgs,
    description="Create an HTTP request node. Required: name. Optional: url, method, headers, query, body, timeout, retry, ignore_ssl. Automatically adds to workflow state.",
)
def create_http_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create an HTTP request node and add it to the workflow state."""
    args = HTTPArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=SMTPArgs,
    description="Create an SMTP/email node. Required: name. Optional: to, from, cc, bcc, subject, body. Automatically adds to workflow state.",
)
def create_smtp_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create an SMTP email node and add it to the workflow state."""
    args = SMTPArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=ConditionalArgs,
    description="Create a conditional (if/else) node. Required: name. Optional: expression (boolean expression to evaluate). Automatically adds to workflow state.",
)
def create_conditional_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a conditional branch node and add it to the workflow state."""
    args = ConditionalArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=SwitchArgs,
    description="Create a switch (multi-way branch) node. Required: name. Optional: rules (array of {value, operator, compare}). Automatically adds to workflow state.",
)
def create_switch_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a switch node and add it to the workflow state."""
    args = SwitchArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    description="Create an edge connecting two nodes. Automatically adds to workflow state. Returns JSON with edge_id and edge object."
)
def create_edge(
    runtime: ToolRuntime,
    src_id: str,
    dst_id: str,
    id: str | None = None,
    label: str | None = None,
) -> Command:
    """Create an edge connecting two nodes and add it to the workflow state.

    Args:
        runtime: Runtime context (automatically injected, hidden from model).
        src_id: Source node ID (required).
        dst_id: Destination node ID (required).
        id: Edge ID. If not provided, a UUID will be generated.
        label: Optional edge label. For conditional nodes, use 'true' or 'false'.

    Returns:
        Command to update state with the new edge.
    """
    edge_id = id or str(uuid.uuid4())
    edge = WorkflowEdge(
        id=edge_id,
        src=src_id,
        dst=dst_id,
        label=label,
    )

    edge_dict = edge.model_dump(exclude_none=True)

    # Get current edges from state and append new edge
    workflow_edges = runtime.state.get("workflow_edges", [])
    updated_edges = workflow_edges + [edge_dict]

    # Create ToolMessage with the result
    tool_message = ToolMessage(
        content=json.dumps({"edge_id": edge_id, "edge": edge_dict}),
        tool_call_id=runtime.tool_call_id,
    )

    # Return Command to update state with messages
    return Command(
        update={
            "workflow_edges": updated_edges,
            "messages": [tool_message],
        },
    )


@tool(
    description="Delete a node from the workflow by its ID. Use this to fix mistakes or remove unwanted nodes."
)
def delete_node(
    runtime: ToolRuntime,
    node_id: str,
) -> Command:
    """Delete a node from the workflow state by its ID.

    Args:
        runtime: Runtime context (automatically injected, hidden from model).
        node_id: The ID of the node to delete.

    Returns:
        Command to update state with the node removed.
    """
    workflow_nodes = runtime.state.get("workflow_nodes", [])

    # Find and remove the node
    deleted_node = None
    updated_nodes = []
    for node in workflow_nodes:
        if node["id"] == node_id:
            deleted_node = node
        else:
            updated_nodes.append(node)

    if deleted_node:
        # Create ToolMessage with the result
        tool_message = ToolMessage(
            content=json.dumps(
                {
                    "success": True,
                    "message": f"Node '{deleted_node.get('name', node_id)}' deleted successfully",
                    "deleted_node": deleted_node,
                }
            ),
            tool_call_id=runtime.tool_call_id,
        )
        return Command(
            update={
                "workflow_nodes": updated_nodes,
                "messages": [tool_message],
            },
        )
    else:
        # No update needed, just return message
        tool_message = ToolMessage(
            content=json.dumps(
                {"success": False, "message": f"Node with ID '{node_id}' not found"}
            ),
            tool_call_id=runtime.tool_call_id,
        )
        return Command(
            update={"messages": [tool_message]},
        )


@tool(
    description="Delete an edge from the workflow by its ID. Use this to fix incorrect connections or remove unwanted edges."
)
def delete_edge(
    runtime: ToolRuntime,
    edge_id: str,
) -> Command:
    """Delete an edge from the workflow state by its ID.

    Args:
        runtime: Runtime context (automatically injected, hidden from model).
        edge_id: The ID of the edge to delete.

    Returns:
        Command to update state with the edge removed.
    """
    workflow_edges = runtime.state.get("workflow_edges", [])

    # Find and remove the edge
    deleted_edge = None
    updated_edges = []
    for edge in workflow_edges:
        if edge["id"] == edge_id:
            deleted_edge = edge
        else:
            updated_edges.append(edge)

    if deleted_edge:
        # Create ToolMessage with the result
        tool_message = ToolMessage(
            content=json.dumps(
                {
                    "success": True,
                    "message": "Edge deleted successfully",
                    "deleted_edge": deleted_edge,
                }
            ),
            tool_call_id=runtime.tool_call_id,
        )
        return Command(
            update={
                "workflow_edges": updated_edges,
                "messages": [tool_message],
            },
        )
    else:
        # No update needed, just return message
        tool_message = ToolMessage(
            content=json.dumps(
                {"success": False, "message": f"Edge with ID '{edge_id}' not found"}
            ),
            tool_call_id=runtime.tool_call_id,
        )
        return Command(
            update={"messages": [tool_message]},
        )


@tool(
    description="List all nodes currently in the workflow. Use this to see what has been created."
)
def list_workflow_nodes(
    runtime: ToolRuntime,
) -> str:
    """List all nodes in the workflow state.

    Args:
        runtime: Runtime context (automatically injected, hidden from model).

    Returns:
        JSON string with all workflow nodes.
    """
    workflow_nodes = runtime.state.get("workflow_nodes", [])
    return json.dumps(
        {"total_nodes": len(workflow_nodes), "nodes": workflow_nodes}, indent=2
    )


@tool(
    description="List all edges currently in the workflow. Use this to see what connections have been created."
)
def list_workflow_edges(
    runtime: ToolRuntime,
) -> str:
    """List all edges in the workflow state.

    Args:
        runtime: Runtime context (automatically injected, hidden from model).

    Returns:
        JSON string with all workflow edges.
    """
    workflow_edges = runtime.state.get("workflow_edges", [])
    return json.dumps(
        {"total_edges": len(workflow_edges), "edges": workflow_edges}, indent=2
    )


SMITH_TOOLS = [
    create_trigger_node,
    create_http_node,
    create_smtp_node,
    create_conditional_node,
    create_switch_node,
    create_edge,
    delete_node,
    delete_edge,
    list_workflow_nodes,
    list_workflow_edges,
]
