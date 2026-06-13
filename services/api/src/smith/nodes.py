from typing import Literal, Optional

from pydantic import BaseModel, Field


# Planning todos are handled by the prebuilt ``TodoListMiddleware``; there are
# no hand-rolled todo arg models here.


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


class WebhookTriggerArgs(BaseModel):
    """Arguments for creating a webhook trigger node."""

    node_type: Literal["webhookTrigger"] = Field(
        default="webhookTrigger", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
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
    input_array: str = Field(
        ..., description="Variable reference to the array to iterate over (e.g., '$FetchUsers.body.users')"
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


# Date/time shift units shared by dateTimeAdd / dateTimeSubtract.
DateTimeUnit = Literal[
    "seconds", "minutes", "hours", "days", "weeks", "months", "years"
]

# Reused field descriptions for the date/time family.
_DT_FORMAT_DESC = (
    "Output format as a Go time layout (e.g. '2006-01-02', "
    "'2006-01-02 15:04:05', or RFC3339). Defaults to RFC3339."
)
_DT_TIMEZONE_DESC = "IANA timezone (e.g. 'UTC', 'America/New_York'). Defaults to UTC."


class DateTimeNowArgs(BaseModel):
    """Arguments for creating a dateTimeNow node (current date/time)."""

    node_type: Literal["dateTimeNow"] = Field(
        default="dateTimeNow", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    timezone: Optional[str] = Field(default=None, description=_DT_TIMEZONE_DESC)
    format: Optional[str] = Field(default=None, description=_DT_FORMAT_DESC)


class DateTimeAddArgs(BaseModel):
    """Arguments for creating a dateTimeAdd node (date/time + duration)."""

    node_type: Literal["dateTimeAdd"] = Field(
        default="dateTimeAdd", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    amount: int = Field(
        ..., description="Number of units to add (e.g. 5)"
    )
    date: Optional[str] = Field(
        default=None,
        description="Base date string. Omit to add to the current time.",
    )
    unit: Optional[DateTimeUnit] = Field(
        default=None, description="Duration unit (defaults to days)"
    )
    timezone: Optional[str] = Field(default=None, description=_DT_TIMEZONE_DESC)
    format: Optional[str] = Field(default=None, description=_DT_FORMAT_DESC)


class DateTimeSubtractArgs(BaseModel):
    """Arguments for creating a dateTimeSubtract node (date/time - duration)."""

    node_type: Literal["dateTimeSubtract"] = Field(
        default="dateTimeSubtract", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    amount: int = Field(
        ..., description="Number of units to subtract (e.g. 5)"
    )
    date: Optional[str] = Field(
        default=None,
        description="Base date string. Omit to subtract from the current time.",
    )
    unit: Optional[DateTimeUnit] = Field(
        default=None, description="Duration unit (defaults to days)"
    )
    timezone: Optional[str] = Field(default=None, description=_DT_TIMEZONE_DESC)
    format: Optional[str] = Field(default=None, description=_DT_FORMAT_DESC)


class DateTimeFormatArgs(BaseModel):
    """Arguments for creating a dateTimeFormat node (reformat a date string)."""

    node_type: Literal["dateTimeFormat"] = Field(
        default="dateTimeFormat", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    date: str = Field(..., description="Input date string to reformat")
    timezone: Optional[str] = Field(default=None, description=_DT_TIMEZONE_DESC)
    format: Optional[str] = Field(default=None, description=_DT_FORMAT_DESC)


class DateTimeParseArgs(BaseModel):
    """Arguments for creating a dateTimeParse node (parse a date string)."""

    node_type: Literal["dateTimeParse"] = Field(
        default="dateTimeParse", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    date: str = Field(..., description="Input date string to parse")
    timezone: Optional[str] = Field(default=None, description=_DT_TIMEZONE_DESC)


# ── Integration Args ─────────────────────────────────────────────────────────
#
# Integration node ``node_type`` strings are the worker integration *kinds* and
# MUST match the worker registry exactly (see ``test/smith/test_docs.py``). The
# frontend's ``workflowDataToCanvas`` maps ``{type: "integration.…",
# parameters}`` onto a canvas integration node ({integrationKind, arguments}),
# so Smith only needs to emit the kind plus snake_case ``parameters``. Every
# integration node requires a Google credential selected on the canvas; it will
# not save or run without one.

_SHEETS_SPREADSHEET_ID_DESC = (
    "Spreadsheet ID from the sheet URL "
    "(https://docs.google.com/spreadsheets/d/<id>/edit)."
)
_SHEETS_VALUES_DESC = (
    "Row/cell values as a JSON two-dimensional array string, e.g. "
    '\'[["Name", "Email"], ["Alice", "a@example.com"]]\'.'
)
_SHEETS_VALUE_INPUT_DESC = (
    "How values are interpreted: 'USER_ENTERED' (parse like the UI) or 'RAW'."
)


# Gmail ------------------------------------------------------------------------


class GmailSendEmailArgs(BaseModel):
    """Arguments for a Gmail 'send email' integration node."""

    node_type: Literal["integration.google.gmail.send_email"] = Field(
        default="integration.google.gmail.send_email", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    to: str = Field(..., description="Recipient email address(es)")
    subject: str = Field(..., description="Email subject")
    body: str = Field(..., description="Email body")
    cc: Optional[str] = Field(default=None, description="CC email address(es)")
    bcc: Optional[str] = Field(default=None, description="BCC email address(es)")


class GmailReadEmailArgs(BaseModel):
    """Arguments for a Gmail 'read email' integration node."""

    node_type: Literal["integration.google.gmail.read_email"] = Field(
        default="integration.google.gmail.read_email", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    id: str = Field(..., description="Gmail message ID to read")
    format: Optional[Literal["full", "metadata", "minimal", "raw"]] = Field(
        default=None, description="Message detail level (defaults to full)"
    )


class GmailSearchEmailsArgs(BaseModel):
    """Arguments for a Gmail 'search emails' integration node."""

    node_type: Literal["integration.google.gmail.search_emails"] = Field(
        default="integration.google.gmail.search_emails", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    q: str = Field(
        ..., description="Gmail search query (e.g. 'is:unread from:boss@example.com')"
    )
    # Worker reads camelCase keys for these three params.
    max_results: Optional[int] = Field(
        default=None, alias="maxResults", description="Maximum number of results"
    )
    label_ids: Optional[str] = Field(
        default=None,
        alias="labelIds",
        description="Comma-separated label IDs (e.g. 'INBOX,UNREAD')",
    )
    include_spam_trash: Optional[bool] = Field(
        default=None,
        alias="includeSpamTrash",
        description="Include results from spam and trash",
    )


class GmailListLabelsArgs(BaseModel):
    """Arguments for a Gmail 'list labels' integration node."""

    node_type: Literal["integration.google.gmail.list_labels"] = Field(
        default="integration.google.gmail.list_labels", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )


# Sheets -----------------------------------------------------------------------


class SheetsReadRangeArgs(BaseModel):
    """Arguments for a Google Sheets 'read range' integration node."""

    node_type: Literal["integration.google.sheets.read_range"] = Field(
        default="integration.google.sheets.read_range", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    spreadsheet_id: str = Field(..., description=_SHEETS_SPREADSHEET_ID_DESC)
    range: str = Field(..., description="A1 notation range (e.g. 'Sheet1!A1:B10')")


class SheetsWriteRangeArgs(BaseModel):
    """Arguments for a Google Sheets 'write range' integration node."""

    node_type: Literal["integration.google.sheets.write_range"] = Field(
        default="integration.google.sheets.write_range", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    spreadsheet_id: str = Field(..., description=_SHEETS_SPREADSHEET_ID_DESC)
    range: str = Field(..., description="A1 notation range (e.g. 'Sheet1!A1:B10')")
    values: str = Field(..., description=_SHEETS_VALUES_DESC)
    value_input_option: Optional[Literal["USER_ENTERED", "RAW"]] = Field(
        default=None, description=_SHEETS_VALUE_INPUT_DESC
    )


class SheetsAppendRowArgs(BaseModel):
    """Arguments for a Google Sheets 'append row' integration node."""

    node_type: Literal["integration.google.sheets.append_row"] = Field(
        default="integration.google.sheets.append_row", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    spreadsheet_id: str = Field(..., description=_SHEETS_SPREADSHEET_ID_DESC)
    sheet_name: str = Field(..., description="Worksheet tab name (e.g. 'Sheet1')")
    values: str = Field(..., description=_SHEETS_VALUES_DESC)
    value_input_option: Optional[Literal["USER_ENTERED", "RAW"]] = Field(
        default=None, description=_SHEETS_VALUE_INPUT_DESC
    )


class SheetsUpdateRowArgs(BaseModel):
    """Arguments for a Google Sheets 'update row' integration node."""

    node_type: Literal["integration.google.sheets.update_row"] = Field(
        default="integration.google.sheets.update_row", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    spreadsheet_id: str = Field(..., description=_SHEETS_SPREADSHEET_ID_DESC)
    sheet_name: str = Field(..., description="Worksheet tab name (e.g. 'Sheet1')")
    row_number: int = Field(..., description="1-based row number to update")
    start_column: str = Field(
        ..., description="Column letter where the row values start (e.g. 'A')"
    )
    values: str = Field(..., description=_SHEETS_VALUES_DESC)
    value_input_option: Optional[Literal["USER_ENTERED", "RAW"]] = Field(
        default=None, description=_SHEETS_VALUE_INPUT_DESC
    )


class SheetsClearArgs(BaseModel):
    """Arguments for a Google Sheets 'clear' integration node."""

    node_type: Literal["integration.google.sheets.clear"] = Field(
        default="integration.google.sheets.clear", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    spreadsheet_id: str = Field(..., description=_SHEETS_SPREADSHEET_ID_DESC)
    sheet_name: Optional[str] = Field(
        default=None, description="Worksheet tab name (e.g. 'Sheet1')"
    )
    range: Optional[str] = Field(
        default=None,
        description="A1 notation range to clear. Omit to clear the whole sheet.",
    )


class SheetsCreateSheetArgs(BaseModel):
    """Arguments for a Google Sheets 'create sheet' integration node."""

    node_type: Literal["integration.google.sheets.create_sheet"] = Field(
        default="integration.google.sheets.create_sheet", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    spreadsheet_id: str = Field(..., description=_SHEETS_SPREADSHEET_ID_DESC)
    title: str = Field(..., description="Title of the new worksheet tab")
    rows: Optional[int] = Field(default=None, description="Number of rows (e.g. 100)")
    columns: Optional[int] = Field(
        default=None, description="Number of columns (e.g. 26)"
    )


class SheetsDeleteSheetArgs(BaseModel):
    """Arguments for a Google Sheets 'delete sheet' integration node."""

    node_type: Literal["integration.google.sheets.delete_sheet"] = Field(
        default="integration.google.sheets.delete_sheet", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    spreadsheet_id: str = Field(..., description=_SHEETS_SPREADSHEET_ID_DESC)
    sheet_name: str = Field(..., description="Worksheet tab name to delete")


class SheetsDeleteRowsArgs(BaseModel):
    """Arguments for a Google Sheets 'delete rows' integration node."""

    node_type: Literal["integration.google.sheets.delete_rows"] = Field(
        default="integration.google.sheets.delete_rows", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    spreadsheet_id: str = Field(..., description=_SHEETS_SPREADSHEET_ID_DESC)
    sheet_name: str = Field(..., description="Worksheet tab name (e.g. 'Sheet1')")
    start_row: int = Field(..., description="1-based first row to delete")
    row_count: int = Field(..., description="Number of rows to delete")


class SheetsDeleteColumnsArgs(BaseModel):
    """Arguments for a Google Sheets 'delete columns' integration node."""

    node_type: Literal["integration.google.sheets.delete_columns"] = Field(
        default="integration.google.sheets.delete_columns", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    spreadsheet_id: str = Field(..., description=_SHEETS_SPREADSHEET_ID_DESC)
    sheet_name: str = Field(..., description="Worksheet tab name (e.g. 'Sheet1')")
    start_column: str = Field(
        ..., description="Column letter where deletion starts (e.g. 'A')"
    )
    column_count: int = Field(..., description="Number of columns to delete")


class SheetsCreateSpreadsheetArgs(BaseModel):
    """Arguments for a Google Sheets 'create spreadsheet' integration node."""

    node_type: Literal["integration.google.sheets.create_spreadsheet"] = Field(
        default="integration.google.sheets.create_spreadsheet", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    title: str = Field(..., description="Title of the new spreadsheet")


class SheetsDeleteSpreadsheetArgs(BaseModel):
    """Arguments for a Google Sheets 'delete spreadsheet' integration node."""

    node_type: Literal["integration.google.sheets.delete_spreadsheet"] = Field(
        default="integration.google.sheets.delete_spreadsheet", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    spreadsheet_id: str = Field(..., description=_SHEETS_SPREADSHEET_ID_DESC)


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
