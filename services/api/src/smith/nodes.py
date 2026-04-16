from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── Todo / Planning ──────────────────────────────────────────────────────────


class TodoItemInput(BaseModel):
    """A single todo item for plan creation."""

    title: str = Field(..., description="Short title for this step")
    description: Optional[str] = Field(default=None, description="Optional details about this step")


class CreateTodoPlanArgs(BaseModel):
    """Arguments for creating a todo plan."""

    items: list[TodoItemInput] = Field(
        ..., description="Ordered list of todo items for the plan"
    )


class UpdateTodoStatusArgs(BaseModel):
    """Arguments for updating a todo item's status."""

    todo_id: str = Field(..., description="ID of the todo item to mark as done")
    status: Literal["done"] = Field(default="done", description="Mark the todo as done")


# ── Shared sub-models ────────────────────────────────────────────────────────


class SwitchRule(BaseModel):
    """A single rule for switch nodes."""

    value: str = Field(..., description="Variable or value to evaluate")
    operator: Literal["<", ">", "==", "!=", "<=", ">=", "contains"] = Field(
        ..., description="Comparison operator"
    )
    compare: str = Field(..., description="Variable or value to compare against")


class EditAssignment(BaseModel):
    """A single field assignment for edit nodes."""

    name: str = Field(..., description="Field name to set")
    value: str = Field(..., description="Value or expression to assign")
    type: Literal["string", "number", "boolean", "json"] = Field(
        default="string", description="Value type"
    )


class FilterRule(BaseModel):
    """A single rule for filter nodes."""

    field: str = Field(..., description="Field name to evaluate")
    operator: Literal["==", "!=", ">", "<", ">=", "<=", "contains"] = Field(
        ..., description="Comparison operator"
    )
    value: str = Field(..., description="Value to compare against")


class SortRule(BaseModel):
    """A single rule for sort nodes."""

    field: str = Field(..., description="Field name to sort by")
    direction: Literal["asc", "desc"] = Field(
        default="asc", description="Sort direction"
    )
    type: Literal["auto", "text", "number", "date"] = Field(
        default="auto", description="Value type for comparison"
    )


# ── Trigger Args ─────────────────────────────────────────────────────────────


class TriggerArgs(BaseModel):
    """Arguments for creating a manual trigger node."""

    node_type: Literal["trigger"] = Field(
        default="trigger", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )


class ScheduledTriggerArgs(BaseModel):
    """Arguments for creating a scheduled trigger node."""

    node_type: Literal["scheduledTrigger"] = Field(
        default="scheduledTrigger", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    amount: Optional[int] = Field(
        default=None, description="Interval amount (e.g., 5)"
    )
    unit: Optional[Literal["seconds", "minutes", "hours", "days"]] = Field(
        default=None, description="Interval unit"
    )


# ── Action Args ──────────────────────────────────────────────────────────────


class HTTPArgs(BaseModel):
    """Arguments for creating an HTTP node."""

    node_type: Literal["http"] = Field(default="http", description="Node type")
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    url: Optional[str] = Field(default=None, description="URL for the HTTP request")
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"] = Field(
        default="GET", description="HTTP method"
    )
    headers: Optional[str] = Field(
        default=None,
        description='HTTP headers as JSON string (e.g., \'{"Content-Type": "application/json"}\')',
    )
    query: Optional[str] = Field(
        default=None,
        description='Query parameters as JSON string (e.g., \'{"key": "value"}\')',
    )
    body: Optional[str] = Field(
        default=None, description="Request body as JSON string or plain text"
    )
    timeout: Optional[int] = Field(
        default=None, description="Request timeout in seconds"
    )
    retry: Optional[int] = Field(default=None, description="Number of retry attempts")
    ignore_ssl: Optional[bool] = Field(
        default=None, description="Whether to ignore SSL certificate verification"
    )


class SMTPArgs(BaseModel):
    """Arguments for creating an SMTP node."""

    node_type: Literal["smtp"] = Field(default="smtp", description="Node type")
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    from_: Optional[str] = Field(
        default=None, alias="from", description="Sender email address"
    )
    to: Optional[str] = Field(
        default=None,
        description="Recipient email address, only one recipient is allowed",
    )
    cc: list[str] = Field(
        default_factory=list, description="CC email address(es) as array of strings"
    )
    bcc: list[str] = Field(
        default_factory=list, description="BCC email address(es) as array of strings"
    )
    subject: Optional[str] = Field(default=None, description="Email subject")
    body: Optional[str] = Field(default=None, description="Email body")


class LogArgs(BaseModel):
    """Arguments for creating a log node."""

    node_type: Literal["log"] = Field(default="log", description="Node type")
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    message: Optional[str] = Field(
        default=None, description="Log message (supports $NodeName.field references)"
    )
    level: Optional[Literal["info", "warn", "error", "debug"]] = Field(
        default=None, description="Log level"
    )


# ── Branching Args ───────────────────────────────────────────────────────────


class IfArgs(BaseModel):
    """Arguments for creating an if/else conditional node."""

    node_type: Literal["if"] = Field(
        default="if", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    expression: Optional[str] = Field(
        default=None,
        description="Boolean expression to evaluate (e.g., '$FetchAPI.status == 200')",
    )


class SwitchArgs(BaseModel):
    """Arguments for creating a switch node."""

    node_type: Literal["switch"] = Field(default="switch", description="Node type")
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    rules: list[SwitchRule] = Field(
        default_factory=list, description="List of rules for branching"
    )


class MergeArgs(BaseModel):
    """Arguments for creating a merge node."""

    node_type: Literal["merge"] = Field(default="merge", description="Node type")
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    wait_mode: Optional[Literal["wait_for_all", "wait_for_any"]] = Field(
        default=None, description="How to wait for incoming branches"
    )
    timeout: Optional[int] = Field(
        default=None, description="Timeout in seconds (0 = no timeout)"
    )


# ── Data Transformation Args ─────────────────────────────────────────────────


class EditArgs(BaseModel):
    """Arguments for creating an edit/transform node."""

    node_type: Literal["edit"] = Field(default="edit", description="Node type")
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    mode: Optional[Literal["assignments", "keep_only"]] = Field(
        default=None, description="Edit mode: 'assignments' to set fields, 'keep_only' to filter fields"
    )
    assignments: Optional[list[EditAssignment]] = Field(
        default=None, description="List of field assignments"
    )


class FilterArgs(BaseModel):
    """Arguments for creating a filter node."""

    node_type: Literal["filter"] = Field(default="filter", description="Node type")
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    input_array: Optional[str] = Field(
        default=None, description="Variable reference to the array to filter (e.g., '$FetchUsers.body.users')"
    )
    match_mode: Optional[Literal["all", "any"]] = Field(
        default=None, description="Match mode: 'all' requires all rules to match, 'any' requires at least one"
    )
    rules: Optional[list[FilterRule]] = Field(
        default=None, description="List of filter rules"
    )


class SortArgs(BaseModel):
    """Arguments for creating a sort node."""

    node_type: Literal["sort"] = Field(default="sort", description="Node type")
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    input_array: Optional[str] = Field(
        default=None, description="Variable reference to the array to sort"
    )
    rules: Optional[list[SortRule]] = Field(
        default=None, description="List of sort rules"
    )


class LimitArgs(BaseModel):
    """Arguments for creating a limit node."""

    node_type: Literal["limit"] = Field(default="limit", description="Node type")
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    input_array: Optional[str] = Field(
        default=None, description="Variable reference to the array to limit"
    )
    count: Optional[int] = Field(
        default=None, description="Maximum number of items to keep"
    )


# ── Iteration Args ───────────────────────────────────────────────────────────


class SplitArgs(BaseModel):
    """Arguments for creating a split (iterate) node."""

    node_type: Literal["split"] = Field(default="split", description="Node type")
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    array_field: Optional[str] = Field(
        default=None, description="Variable reference to the array field to iterate over (e.g., '$FetchUsers.body.users')"
    )


class AggregatorArgs(BaseModel):
    """Arguments for creating an aggregator node."""

    node_type: Literal["aggregator"] = Field(default="aggregator", description="Node type")
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )


# ── Timing Args ──────────────────────────────────────────────────────────────


class WaitArgs(BaseModel):
    """Arguments for creating a wait/delay node."""

    node_type: Literal["wait"] = Field(default="wait", description="Node type")
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    amount: Optional[int] = Field(
        default=None, description="Wait duration amount"
    )
    unit: Optional[Literal["seconds", "minutes", "hours", "days"]] = Field(
        default=None, description="Wait duration unit"
    )


class DatetimeArgs(BaseModel):
    """Arguments for creating a datetime node."""

    node_type: Literal["datetime"] = Field(default="datetime", description="Node type")
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    operation: Optional[Literal["now", "add", "subtract", "format"]] = Field(
        default=None, description="Date/time operation to perform"
    )
    date: Optional[str] = Field(
        default=None, description="Input date string (for add/subtract/format operations)"
    )
    amount: Optional[int] = Field(
        default=None, description="Amount to add or subtract"
    )
    unit: Optional[Literal["seconds", "minutes", "hours", "days", "weeks", "months", "years"]] = Field(
        default=None, description="Unit for add/subtract operations"
    )
    format: Optional[str] = Field(
        default=None, description="Date format string (e.g., 'YYYY-MM-DD')"
    )
    timezone: Optional[str] = Field(
        default=None, description="Timezone (e.g., 'UTC', 'America/New_York')"
    )


# ── Update Node Args ─────────────────────────────────────────────────────────


class UpdateNodeArgs(BaseModel):
    """Arguments for updating an existing node."""

    node_id: str = Field(..., description="ID of the node to update")
    name: Optional[str] = Field(
        default=None, description="New node name (if changing)"
    )
    parameters: Optional[dict] = Field(
        default=None, description="Parameters to merge into the node's existing parameters"
    )
