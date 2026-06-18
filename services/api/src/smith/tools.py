import json
import uuid

from langchain.tools import ToolRuntime, tool
from langchain_core.messages import ToolMessage
from langgraph.types import Command

from .nodes import (
    AggregatorArgs,
    DateTimeAddArgs,
    DateTimeFormatArgs,
    DateTimeNowArgs,
    DateTimeParseArgs,
    DateTimeSubtractArgs,
    EditArgs,
    FilterArgs,
    GmailListLabelsArgs,
    GmailReadEmailArgs,
    GmailSearchEmailsArgs,
    GmailSendEmailArgs,
    HTTPArgs,
    IfArgs,
    LimitArgs,
    LogArgs,
    MergeArgs,
    SMTPArgs,
    ScheduledTriggerArgs,
    SheetsAppendRowArgs,
    SheetsClearArgs,
    SheetsCreateSheetArgs,
    SheetsCreateSpreadsheetArgs,
    SheetsDeleteColumnsArgs,
    SheetsDeleteRowsArgs,
    SheetsDeleteSheetArgs,
    SheetsDeleteSpreadsheetArgs,
    SheetsReadRangeArgs,
    SheetsUpdateRowArgs,
    SheetsWriteRangeArgs,
    SortArgs,
    SplitArgs,
    SwitchArgs,
    TriggerArgs,
    UpdateNodeArgs,
    WaitArgs,
    WebhookTriggerArgs,
)
from .schemas import WorkflowEdge, WorkflowNode

# ── Node creation helper ─────────────────────────────────────────────────────


def _create_node_from_args(args, runtime: ToolRuntime) -> Command:
    """Helper to extract params and build a workflow node from any Args model."""
    node_type = args.node_type
    name = args.name
    params = args.model_dump(
        exclude={"node_type", "name"}, exclude_none=True, by_alias=True
    )

    # Parse JSON strings into dicts/lists for any param that looks like JSON
    for key, value in list(params.items()):
        if isinstance(value, str) and value.strip().startswith(("{", "[")):
            try:
                params[key] = json.loads(value)
            except json.JSONDecodeError:
                pass  # Keep as string if not valid JSON

    node_id = str(uuid.uuid4())
    is_trigger = node_type in ("trigger", "scheduledTrigger", "webhookTrigger")

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


# ── Trigger node tools ───────────────────────────────────────────────────────


@tool(
    args_schema=TriggerArgs,
    description="Create a manual trigger node (workflow entry point). Every workflow needs exactly one trigger. Automatically adds to workflow state.",
)
def create_trigger_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a trigger node and add it to the workflow state."""
    args = TriggerArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=ScheduledTriggerArgs,
    description="Create a scheduled trigger node (runs on a recurring interval). Use instead of manual trigger for automated workflows. Params: amount (number), unit (seconds/minutes/hours/days).",
)
def create_scheduled_trigger_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a scheduled trigger node and add it to the workflow state."""
    args = ScheduledTriggerArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=WebhookTriggerArgs,
    description="Create a webhook trigger node (entry point that starts the workflow when an HTTP request hits its URL). No parameters; the webhook URL is assigned on the canvas.",
)
def create_webhook_trigger_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a webhook trigger node and add it to the workflow state."""
    args = WebhookTriggerArgs(**kwargs)
    return _create_node_from_args(args, runtime)


# ── Action node tools ────────────────────────────────────────────────────────


@tool(
    args_schema=HTTPArgs,
    description="Create an HTTP request node. Required: name. Optional: url, method, headers (JSON string), query (JSON string), body (JSON string or text), timeout, retry, ignore_ssl.",
)
def create_http_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create an HTTP request node and add it to the workflow state."""
    args = HTTPArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=SMTPArgs,
    description="Create an SMTP/email node. Required: name. Optional: from, to, cc, bcc, subject, body. Supports $NodeName.field references in fields.",
)
def create_smtp_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create an SMTP email node and add it to the workflow state."""
    args = SMTPArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=LogArgs,
    description="Create a log/debug node. Required: name. Optional: message (supports $NodeName.field references), level (info/warn/error/debug).",
)
def create_log_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a log node and add it to the workflow state."""
    args = LogArgs(**kwargs)
    return _create_node_from_args(args, runtime)


# ── Branching node tools ─────────────────────────────────────────────────────


@tool(
    args_schema=IfArgs,
    description="Create an if/else (conditional) node with two output branches. Required: name. Optional: expression (e.g., '$FetchAPI.status == 200'). Connect with edge labels 'true' and 'false'.",
)
def create_if_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create an if/else conditional branch node and add it to the workflow state."""
    args = IfArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=SwitchArgs,
    description="Create a switch (multi-way branch) node. Required: name. Optional: rules (array of {value, operator, compare}). Connect with edge labels 'case 1', 'case 2', ..., 'fallback'.",
)
def create_switch_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a switch node and add it to the workflow state."""
    args = SwitchArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=MergeArgs,
    description="Create a merge node to rejoin multiple branches back into one path. Required: name. Optional: wait_mode (wait_for_all/wait_for_any), timeout (seconds).",
)
def create_merge_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a merge node and add it to the workflow state."""
    args = MergeArgs(**kwargs)
    return _create_node_from_args(args, runtime)


# ── Data transformation node tools ───────────────────────────────────────────


@tool(
    args_schema=EditArgs,
    description="Create an edit node to transform data by setting or filtering fields. Required: name. Optional: mode ('assignments' to set fields, 'keep_only' to filter), assignments (list of {name, value, type}).",
)
def create_edit_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create an edit/transform node and add it to the workflow state."""
    args = EditArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=FilterArgs,
    description="Create a filter node to keep only matching items from an array. Required: name. Optional: input_array (e.g., '$FetchUsers.body.users'), match_mode (all/any), rules (list of {field, operator, value}).",
)
def create_filter_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a filter node and add it to the workflow state."""
    args = FilterArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=SortArgs,
    description="Create a sort node to reorder items in an array. Required: name. Optional: input_array, rules (list of {field, direction: asc/desc, type: auto/text/number/date}).",
)
def create_sort_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a sort node and add it to the workflow state."""
    args = SortArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=LimitArgs,
    description="Create a limit node to take only the first N items from an array. Required: name. Optional: input_array, count.",
)
def create_limit_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a limit node and add it to the workflow state."""
    args = LimitArgs(**kwargs)
    return _create_node_from_args(args, runtime)


# ── Iteration node tools ─────────────────────────────────────────────────────


@tool(
    args_schema=SplitArgs,
    description="Create a split node to iterate over an array, processing each item individually. Inside the split body, use $item to reference the current element. Required: name, input_array (e.g., '$FetchUsers.body.users').",
)
def create_split_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a split/iterate node and add it to the workflow state."""
    args = SplitArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=AggregatorArgs,
    description="Create an aggregator node to collect all items back into an array after a split. Always pair with a split node. Required: name. No other parameters.",
)
def create_aggregator_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create an aggregator node and add it to the workflow state."""
    args = AggregatorArgs(**kwargs)
    return _create_node_from_args(args, runtime)


# ── Timing node tools ────────────────────────────────────────────────────────


@tool(
    args_schema=WaitArgs,
    description="Create a wait/delay node to pause workflow execution. Required: name. Optional: amount (number), unit (seconds/minutes/hours/days).",
)
def create_wait_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a wait/delay node and add it to the workflow state."""
    args = WaitArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=DateTimeNowArgs,
    description="Create a dateTimeNow node that outputs the current date/time. Required: name. Optional: timezone, format (Go time layout).",
)
def create_datetime_now_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a dateTimeNow node and add it to the workflow state."""
    args = DateTimeNowArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=DateTimeAddArgs,
    description="Create a dateTimeAdd node that adds a duration to a date/time. Required: name, amount. Optional: date (defaults to now), unit (seconds/minutes/hours/days/weeks/months/years), timezone, format.",
)
def create_datetime_add_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a dateTimeAdd node and add it to the workflow state."""
    args = DateTimeAddArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=DateTimeSubtractArgs,
    description="Create a dateTimeSubtract node that subtracts a duration from a date/time. Required: name, amount. Optional: date (defaults to now), unit (seconds/minutes/hours/days/weeks/months/years), timezone, format.",
)
def create_datetime_subtract_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a dateTimeSubtract node and add it to the workflow state."""
    args = DateTimeSubtractArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=DateTimeFormatArgs,
    description="Create a dateTimeFormat node that reformats a date string. Required: name, date. Optional: timezone, format (Go time layout).",
)
def create_datetime_format_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a dateTimeFormat node and add it to the workflow state."""
    args = DateTimeFormatArgs(**kwargs)
    return _create_node_from_args(args, runtime)


@tool(
    args_schema=DateTimeParseArgs,
    description="Create a dateTimeParse node that parses a date string into a normalized timestamp. Required: name, date. Optional: timezone.",
)
def create_datetime_parse_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Create a dateTimeParse node and add it to the workflow state."""
    args = DateTimeParseArgs(**kwargs)
    return _create_node_from_args(args, runtime)


# ── Integration node tools ───────────────────────────────────────────────────
#
# Gmail and Google Sheets integration nodes. Each emits the worker integration
# ``kind`` as ``node_type`` plus snake_case ``parameters``; the frontend maps
# that onto a canvas integration node. The user must select a Google credential
# on the canvas for these nodes to save and run. One distinct tool is registered
# per op (the LLM tool selector narrows the large pool per request), built from
# a shared factory to stay DRY.


def _make_integration_tool(args_model, tool_name: str, description: str):
    """Build a node-creation tool for a single integration op.

    Args:
        args_model: The pydantic Args model whose ``node_type`` default is the
            worker integration kind.
        tool_name: Unique tool name exposed to the model (no dots).
        description: Selector/model-facing tool description.

    Returns:
        A langchain ``@tool`` that appends the integration node to state.
    """

    @tool(tool_name, args_schema=args_model, description=description)
    def _integration_node_tool(runtime: ToolRuntime, **kwargs) -> Command:
        args = args_model(**kwargs)
        return _create_node_from_args(args, runtime)

    return _integration_node_tool


_CREDENTIAL_NOTE = " Requires a Google credential selected on the canvas."

_INTEGRATION_TOOL_SPECS = [
    (
        GmailSendEmailArgs,
        "create_gmail_send_email_node",
        "Create a Gmail node that sends an email. Params: to, subject, body, cc, bcc.",
    ),
    (
        GmailReadEmailArgs,
        "create_gmail_read_email_node",
        "Create a Gmail node that reads one email by message id. Params: id, format.",
    ),
    (
        GmailSearchEmailsArgs,
        "create_gmail_search_emails_node",
        "Create a Gmail node that searches emails with a query. Params: q, maxResults, labelIds, includeSpamTrash.",
    ),
    (
        GmailListLabelsArgs,
        "create_gmail_list_labels_node",
        "Create a Gmail node that lists all labels. No params.",
    ),
    (
        SheetsReadRangeArgs,
        "create_sheets_read_range_node",
        "Create a Google Sheets node that reads a range of cells. Params: spreadsheet_id, range.",
    ),
    (
        SheetsWriteRangeArgs,
        "create_sheets_write_range_node",
        "Create a Google Sheets node that writes values to a range. Params: spreadsheet_id, range, values, value_input_option.",
    ),
    (
        SheetsAppendRowArgs,
        "create_sheets_append_row_node",
        "Create a Google Sheets node that appends row(s) to a sheet. Params: spreadsheet_id, sheet_name, values, value_input_option.",
    ),
    (
        SheetsUpdateRowArgs,
        "create_sheets_update_row_node",
        "Create a Google Sheets node that updates a row by number. Params: spreadsheet_id, sheet_name, row_number, start_column, values, value_input_option.",
    ),
    (
        SheetsClearArgs,
        "create_sheets_clear_node",
        "Create a Google Sheets node that clears a sheet or range. Params: spreadsheet_id, sheet_name, range.",
    ),
    (
        SheetsCreateSheetArgs,
        "create_sheets_create_sheet_node",
        "Create a Google Sheets node that adds a new sheet/tab to a spreadsheet. Params: spreadsheet_id, title, rows, columns.",
    ),
    (
        SheetsDeleteSheetArgs,
        "create_sheets_delete_sheet_node",
        "Create a Google Sheets node that deletes a sheet/tab. Params: spreadsheet_id, sheet_name.",
    ),
    (
        SheetsDeleteRowsArgs,
        "create_sheets_delete_rows_node",
        "Create a Google Sheets node that deletes rows. Params: spreadsheet_id, sheet_name, start_row, row_count.",
    ),
    (
        SheetsDeleteColumnsArgs,
        "create_sheets_delete_columns_node",
        "Create a Google Sheets node that deletes columns. Params: spreadsheet_id, sheet_name, start_column, column_count.",
    ),
    (
        SheetsCreateSpreadsheetArgs,
        "create_sheets_create_spreadsheet_node",
        "Create a Google Sheets node that creates a new spreadsheet. Params: title.",
    ),
    (
        SheetsDeleteSpreadsheetArgs,
        "create_sheets_delete_spreadsheet_node",
        "Create a Google Sheets node that deletes a spreadsheet. Params: spreadsheet_id.",
    ),
]

INTEGRATION_TOOLS = [
    _make_integration_tool(model, tool_name, description + _CREDENTIAL_NOTE)
    for (model, tool_name, description) in _INTEGRATION_TOOL_SPECS
]


# ── Node management tools ────────────────────────────────────────────────────


@tool(
    args_schema=UpdateNodeArgs,
    description="Update an existing node's name and/or parameters. Parameters are merged (not replaced) with existing ones. Use this to modify nodes after creation without losing edges.",
)
def update_node(runtime: ToolRuntime, **kwargs) -> Command:
    """Update an existing node's name and/or parameters.

    Args:
        runtime: Runtime context (automatically injected, hidden from model).
        **kwargs: Unpacked UpdateNodeArgs fields.

    Returns:
        Command to update state with the modified node.
    """
    args = UpdateNodeArgs(**kwargs)
    workflow_nodes = runtime.state.get("workflow_nodes", [])

    updated_node = None
    updated_nodes = []
    for node in workflow_nodes:
        if node["id"] == args.node_id:
            updated = {**node}
            if args.name is not None:
                updated["name"] = args.name
            if args.parameters is not None:
                existing_params = updated.get("parameters", {})
                updated["parameters"] = {**existing_params, **args.parameters}
            updated_node = updated
            updated_nodes.append(updated)
        else:
            updated_nodes.append(node)

    if updated_node:
        tool_message = ToolMessage(
            content=json.dumps({"success": True, "node": updated_node}),
            tool_call_id=runtime.tool_call_id,
        )
        return Command(
            update={
                "workflow_nodes": updated_nodes,
                "messages": [tool_message],
            },
        )
    else:
        tool_message = ToolMessage(
            content=json.dumps(
                {
                    "success": False,
                    "message": f"Node with ID '{args.node_id}' not found",
                }
            ),
            tool_call_id=runtime.tool_call_id,
        )
        return Command(
            update={"messages": [tool_message]},
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


# ── Edge tools ───────────────────────────────────────────────────────────────


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
        label: Optional edge label. For if nodes use 'true'/'false'. For switch nodes use 'case 1', 'case 2', ..., 'fallback'.

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


# ── Discovery tools ──────────────────────────────────────────────────────────


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


# ── Tool registry ────────────────────────────────────────────────────────────


SMITH_TOOLS = [
    # Triggers
    create_trigger_node,
    create_scheduled_trigger_node,
    create_webhook_trigger_node,
    # Actions
    create_http_node,
    create_smtp_node,
    create_log_node,
    # Branching
    create_if_node,
    create_switch_node,
    create_merge_node,
    # Data transformation
    create_edit_node,
    create_filter_node,
    create_sort_node,
    create_limit_node,
    # Iteration
    create_split_node,
    create_aggregator_node,
    # Timing
    create_wait_node,
    create_datetime_now_node,
    create_datetime_add_node,
    create_datetime_subtract_node,
    create_datetime_format_node,
    create_datetime_parse_node,
    # Integrations (Gmail, Google Sheets)
    *INTEGRATION_TOOLS,
    # Node management
    update_node,
    # Connectivity
    create_edge,
    delete_node,
    delete_edge,
    # Discovery
    list_workflow_nodes,
    list_workflow_edges,
]
