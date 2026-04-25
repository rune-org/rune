# fmt: off
"""Auto-generated DSL type definitions.

DO NOT EDIT - Generated from dsl/dsl-definition.json
"""

from __future__ import annotations

from typing import Any, Optional, Literal, Union
from pydantic import BaseModel, Field, ConfigDict

# Core Structures

class Workflow(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Root workflow structure"""
    workflow_id: str  # Unique identifier for the workflow definition
    execution_id: str  # Unique identifier for this specific execution instance
    nodes: list[Node]  # Array of node definitions
    edges: list[Edge]  # Array of edge definitions

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.workflow_id is None:
            errors.append("Workflow.workflow_id is required")
        if self.workflow_id is not None and not isinstance(self.workflow_id, str):
            errors.append("Workflow.workflow_id must be a string")
        if self.execution_id is None:
            errors.append("Workflow.execution_id is required")
        if self.execution_id is not None and not isinstance(self.execution_id, str):
            errors.append("Workflow.execution_id must be a string")
        if self.nodes is None:
            errors.append("Workflow.nodes is required")
        if self.edges is None:
            errors.append("Workflow.edges is required")

        return len(errors) == 0, errors

class Edge(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Connection between two nodes"""
    id: str  # Unique identifier for the edge
    src: str  # Source node ID
    dst: str  # Destination node ID

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.id is None:
            errors.append("Edge.id is required")
        if self.id is not None and not isinstance(self.id, str):
            errors.append("Edge.id must be a string")
        if self.src is None:
            errors.append("Edge.src is required")
        if self.src is not None and not isinstance(self.src, str):
            errors.append("Edge.src must be a string")
        if self.dst is None:
            errors.append("Edge.dst is required")
        if self.dst is not None and not isinstance(self.dst, str):
            errors.append("Edge.dst must be a string")

        return len(errors) == 0, errors

class Credential(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Credential object with sensitive values"""
    id: str  # Unique credential identifier
    name: str  # Human-readable credential name
    type_: Literal["api_key", "oauth2", "basic_auth", "header", "token", "custom", "smtp"] = Field(alias="type")  # Credential type identifier
    values: Optional[dict[str, Any]] = None  # Type-specific credential values (actual secrets)

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.id is None:
            errors.append("Credential.id is required")
        if self.id is not None and not isinstance(self.id, str):
            errors.append("Credential.id must be a string")
        if self.name is None:
            errors.append("Credential.name is required")
        if self.name is not None and not isinstance(self.name, str):
            errors.append("Credential.name must be a string")
        if self.type_ is None:
            errors.append("Credential.type is required")
        if self.type_ is not None and not isinstance(self.type_, str):
            errors.append("Credential.type must be a string")

        return len(errors) == 0, errors

class ErrorHandling(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Error handling configuration"""
    type_: Literal["halt", "ignore", "branch"] = Field(alias="type")  # Error handling strategy
    error_edge: Optional[str] = None  # Edge ID to follow on error (required if type is 'branch')

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.type_ is None:
            errors.append("ErrorHandling.type is required")
        if self.type_ is not None and not isinstance(self.type_, str):
            errors.append("ErrorHandling.type must be a string")
        if self.error_edge is not None and not isinstance(self.error_edge, str):
            errors.append("ErrorHandling.error_edge must be a string")

        return len(errors) == 0, errors

# Nested Types

class SwitchRule(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Switch rule definition"""
    value: str  # Value to compare (supports template variables)
    operator: Literal["==", "!=", ">", "<", ">=", "<=", "contains"]  # Comparison operator
    compare: str  # Value to compare against

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.value is None:
            errors.append("SwitchRule.value is required")
        if self.value is not None and not isinstance(self.value, str):
            errors.append("SwitchRule.value must be a string")
        if self.operator is None:
            errors.append("SwitchRule.operator is required")
        if self.operator is not None and not isinstance(self.operator, str):
            errors.append("SwitchRule.operator must be a string")
        if self.compare is None:
            errors.append("SwitchRule.compare is required")
        if self.compare is not None and not isinstance(self.compare, str):
            errors.append("SwitchRule.compare must be a string")

        return len(errors) == 0, errors

class FilterRule(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Filter rule definition"""
    field: str  # Field path on each list item
    operator: Literal["==", "!=", ">", "<", ">=", "<=", "contains"]  # Comparison operator
    value: Any  # Value to compare against

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.field is None:
            errors.append("FilterRule.field is required")
        if self.field is not None and not isinstance(self.field, str):
            errors.append("FilterRule.field must be a string")
        if self.operator is None:
            errors.append("FilterRule.operator is required")
        if self.operator is not None and not isinstance(self.operator, str):
            errors.append("FilterRule.operator must be a string")
        if self.value is None:
            errors.append("FilterRule.value is required")

        return len(errors) == 0, errors

class SortRule(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Sort rule definition"""
    field: str  # Field path to sort by
    direction: Literal["asc", "desc", "ascending", "descending"]  # Sort direction
    type_: Optional[Literal["auto", "text", "number", "date"]] = Field(alias="type", default=None)  # Value type used for sorting

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.field is None:
            errors.append("SortRule.field is required")
        if self.field is not None and not isinstance(self.field, str):
            errors.append("SortRule.field must be a string")
        if self.direction is None:
            errors.append("SortRule.direction is required")
        if self.direction is not None and not isinstance(self.direction, str):
            errors.append("SortRule.direction must be a string")
        if self.type_ is not None and not isinstance(self.type_, str):
            errors.append("SortRule.type must be a string")

        return len(errors) == 0, errors

class EditAssignment(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Edit node assignment"""
    name: str  # The key to set (supports dot-notation for nested objects)
    value: str  # The value to assign (supports dynamic expressions)
    type_: Optional[Literal["string", "number", "boolean", "json"]] = Field(alias="type", default=None)  # Target type casting

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.name is None:
            errors.append("EditAssignment.name is required")
        if self.name is not None and not isinstance(self.name, str):
            errors.append("EditAssignment.name must be a string")
        if self.value is None:
            errors.append("EditAssignment.value is required")
        if self.value is not None and not isinstance(self.value, str):
            errors.append("EditAssignment.value must be a string")
        if self.type_ is not None and not isinstance(self.type_, str):
            errors.append("EditAssignment.type must be a string")

        return len(errors) == 0, errors

# Node Parameter Types

class ScheduledtriggerParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Scheduled workflow trigger with interval-based execution"""
    amount: Optional[float] = None  # Quantity of time between executions
    unit: Optional[Literal["seconds", "minutes", "hours", "days"]] = None  # Unit of time for the interval

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.amount is not None and not isinstance(self.amount, (int, float)):
            errors.append("ScheduledtriggerParameters.amount must be a number")
        if self.unit is not None and not isinstance(self.unit, str):
            errors.append("ScheduledtriggerParameters.unit must be a string")

        return len(errors) == 0, errors

class HttpParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """HTTP request node"""
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"]  # HTTP method
    url: str  # Target URL (supports template variables)
    body: Optional[Any] = None  # Request body (JSON)
    query: Optional[dict[str, Any]] = None  # URL query parameters as key-value pairs
    headers: Optional[dict[str, Any]] = None  # HTTP headers as key-value pairs
    retry: Optional[str] = None  # Number of retry attempts
    retry_delay: Optional[str] = None  # Delay between retries in seconds
    timeout: Optional[str] = None  # Request timeout in seconds
    raise_on_status: Optional[str] = None  # Comma-separated status code patterns to treat as errors
    ignore_ssl: Optional[bool] = None  # Whether to ignore SSL certificate validation

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.method is None:
            errors.append("HttpParameters.method is required")
        if self.method is not None and not isinstance(self.method, str):
            errors.append("HttpParameters.method must be a string")
        if self.url is None:
            errors.append("HttpParameters.url is required")
        if self.url is not None and not isinstance(self.url, str):
            errors.append("HttpParameters.url must be a string")
        if self.retry is not None and not isinstance(self.retry, str):
            errors.append("HttpParameters.retry must be a string")
        if self.retry_delay is not None and not isinstance(self.retry_delay, str):
            errors.append("HttpParameters.retry_delay must be a string")
        if self.timeout is not None and not isinstance(self.timeout, str):
            errors.append("HttpParameters.timeout must be a string")
        if self.raise_on_status is not None and not isinstance(self.raise_on_status, str):
            errors.append("HttpParameters.raise_on_status must be a string")
        if self.ignore_ssl is not None and not isinstance(self.ignore_ssl, bool):
            errors.append("HttpParameters.ignore_ssl must be a boolean")

        return len(errors) == 0, errors

class SmtpParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Send email via SMTP"""
    subject: str  # Email subject line
    body: str  # Email body content (plain text or HTML)
    to: list[str]  # Primary recipient email addresses
    from_: str = Field(alias="from")  # Sender email address
    cc: Optional[list[str]] = None  # Carbon copy recipients
    bcc: Optional[list[str]] = None  # Blind carbon copy recipients

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.subject is None:
            errors.append("SmtpParameters.subject is required")
        if self.subject is not None and not isinstance(self.subject, str):
            errors.append("SmtpParameters.subject must be a string")
        if self.body is None:
            errors.append("SmtpParameters.body is required")
        if self.body is not None and not isinstance(self.body, str):
            errors.append("SmtpParameters.body must be a string")
        if self.to is None:
            errors.append("SmtpParameters.to is required")
        if self.from_ is None:
            errors.append("SmtpParameters.from is required")
        if self.from_ is not None and not isinstance(self.from_, str):
            errors.append("SmtpParameters.from must be a string")

        return len(errors) == 0, errors

class ConditionalParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """If/else branching based on boolean expression"""
    expression: str  # Boolean expression to evaluate (supports template variables)

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.expression is None:
            errors.append("ConditionalParameters.expression is required")
        if self.expression is not None and not isinstance(self.expression, str):
            errors.append("ConditionalParameters.expression must be a string")

        return len(errors) == 0, errors

class SwitchParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Multi-way branching based on multiple rules"""
    rules: list[SwitchRule]  # Array of switch rules

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.rules is None:
            errors.append("SwitchParameters.rules is required")

        return len(errors) == 0, errors

class LogParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Log information during workflow execution"""
    message: str  # Message to log (supports context variables)
    level: Optional[Literal["debug", "info", "warn", "error"]] = None  # Log level

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.message is None:
            errors.append("LogParameters.message is required")
        if self.message is not None and not isinstance(self.message, str):
            errors.append("LogParameters.message must be a string")
        if self.level is not None and not isinstance(self.level, str):
            errors.append("LogParameters.level must be a string")

        return len(errors) == 0, errors

class DatetimenowParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Get the current date and time in a given timezone"""
    timezone: Optional[str] = None  # IANA timezone used for the output
    format: Optional[str] = None  # Output format string (Go time layout)

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.timezone is not None and not isinstance(self.timezone, str):
            errors.append("DatetimenowParameters.timezone must be a string")
        if self.format is not None and not isinstance(self.format, str):
            errors.append("DatetimenowParameters.format must be a string")

        return len(errors) == 0, errors

class DatetimeaddParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Add a duration to a date or timestamp"""
    date: Optional[str] = None  # Input date or timestamp; defaults to now when empty
    amount: float  # Amount of time to add
    unit: Optional[Literal["seconds", "minutes", "hours", "days", "weeks", "months", "years"]] = None  # Unit of time
    timezone: Optional[str] = None  # IANA timezone used for parsing naive inputs and for the output
    format: Optional[str] = None  # Output format string (Go time layout)

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.date is not None and not isinstance(self.date, str):
            errors.append("DatetimeaddParameters.date must be a string")
        if self.amount is None:
            errors.append("DatetimeaddParameters.amount is required")
        if self.amount is not None and not isinstance(self.amount, (int, float)):
            errors.append("DatetimeaddParameters.amount must be a number")
        if self.unit is not None and not isinstance(self.unit, str):
            errors.append("DatetimeaddParameters.unit must be a string")
        if self.timezone is not None and not isinstance(self.timezone, str):
            errors.append("DatetimeaddParameters.timezone must be a string")
        if self.format is not None and not isinstance(self.format, str):
            errors.append("DatetimeaddParameters.format must be a string")

        return len(errors) == 0, errors

class DatetimesubtractParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Subtract a duration from a date or timestamp"""
    date: Optional[str] = None  # Input date or timestamp; defaults to now when empty
    amount: float  # Amount of time to subtract
    unit: Optional[Literal["seconds", "minutes", "hours", "days", "weeks", "months", "years"]] = None  # Unit of time
    timezone: Optional[str] = None  # IANA timezone used for parsing naive inputs and for the output
    format: Optional[str] = None  # Output format string (Go time layout)

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.date is not None and not isinstance(self.date, str):
            errors.append("DatetimesubtractParameters.date must be a string")
        if self.amount is None:
            errors.append("DatetimesubtractParameters.amount is required")
        if self.amount is not None and not isinstance(self.amount, (int, float)):
            errors.append("DatetimesubtractParameters.amount must be a number")
        if self.unit is not None and not isinstance(self.unit, str):
            errors.append("DatetimesubtractParameters.unit must be a string")
        if self.timezone is not None and not isinstance(self.timezone, str):
            errors.append("DatetimesubtractParameters.timezone must be a string")
        if self.format is not None and not isinstance(self.format, str):
            errors.append("DatetimesubtractParameters.format must be a string")

        return len(errors) == 0, errors

class DatetimeformatParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Format a date or timestamp in a chosen timezone"""
    date: str  # Input date or timestamp to format
    timezone: Optional[str] = None  # IANA timezone used for parsing naive inputs and for the output
    format: Optional[str] = None  # Output format string (Go time layout)

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.date is None:
            errors.append("DatetimeformatParameters.date is required")
        if self.date is not None and not isinstance(self.date, str):
            errors.append("DatetimeformatParameters.date must be a string")
        if self.timezone is not None and not isinstance(self.timezone, str):
            errors.append("DatetimeformatParameters.timezone must be a string")
        if self.format is not None and not isinstance(self.format, str):
            errors.append("DatetimeformatParameters.format must be a string")

        return len(errors) == 0, errors

class DatetimeparseParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Parse a date or timestamp into structured components"""
    date: str  # Input date or timestamp to parse
    timezone: Optional[str] = None  # IANA timezone used for parsing naive inputs and for the structured output

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.date is None:
            errors.append("DatetimeparseParameters.date is required")
        if self.date is not None and not isinstance(self.date, str):
            errors.append("DatetimeparseParameters.date must be a string")
        if self.timezone is not None and not isinstance(self.timezone, str):
            errors.append("DatetimeparseParameters.timezone must be a string")

        return len(errors) == 0, errors

class WaitParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Wait for a specified duration"""
    amount: float  # Quantity of time
    unit: Literal["seconds", "minutes", "hours", "days"]  # Unit of time

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.amount is None:
            errors.append("WaitParameters.amount is required")
        if self.amount is not None and not isinstance(self.amount, (int, float)):
            errors.append("WaitParameters.amount must be a number")
        if self.unit is None:
            errors.append("WaitParameters.unit is required")
        if self.unit is not None and not isinstance(self.unit, str):
            errors.append("WaitParameters.unit must be a string")

        return len(errors) == 0, errors

class EditParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Data transformation node"""
    mode: Optional[Literal["assignments", "keep_only"]] = None  # Transformation mode
    assignments: Optional[list[EditAssignment]] = None  # List of field operations

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.mode is not None and not isinstance(self.mode, str):
            errors.append("EditParameters.mode must be a string")

        return len(errors) == 0, errors

class FilterParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Keep only list items that match one or more rules"""
    input_array: Optional[Any] = None  # Array to filter; defaults to the current working list
    match_mode: Optional[Literal["all", "any"]] = None  # How multiple rules are combined
    rules: list[FilterRule]  # Rules used to decide which items to keep

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.match_mode is not None and not isinstance(self.match_mode, str):
            errors.append("FilterParameters.match_mode must be a string")
        if self.rules is None:
            errors.append("FilterParameters.rules is required")

        return len(errors) == 0, errors

class SortParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Order a list using one or more sort rules"""
    input_array: Optional[Any] = None  # Array to sort; defaults to the current working list
    rules: list[SortRule]  # Ordered sort rules

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.rules is None:
            errors.append("SortParameters.rules is required")

        return len(errors) == 0, errors

class LimitParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Keep only the first items from a list"""
    input_array: Optional[Any] = None  # Array to limit; defaults to the current working list
    count: float  # Number of items to keep

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.count is None:
            errors.append("LimitParameters.count is required")
        if self.count is not None and not isinstance(self.count, (int, float)):
            errors.append("LimitParameters.count must be a number")

        return len(errors) == 0, errors

class SplitParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Split array into individual items (Fan-Out)"""
    input_array: str  # Dynamic reference to the array (e.g., {{ $node.Http.body.users }})

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.input_array is None:
            errors.append("SplitParameters.input_array is required")
        if self.input_array is not None and not isinstance(self.input_array, str):
            errors.append("SplitParameters.input_array must be a string")

        return len(errors) == 0, errors

class MergeParameters(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Merge multiple execution branches"""
    wait_mode: Optional[Literal["wait_for_all", "wait_for_any"]] = None  # Synchronization mode
    timeout: Optional[float] = None  # Safety timeout in seconds

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.wait_mode is not None and not isinstance(self.wait_mode, str):
            errors.append("MergeParameters.wait_mode must be a string")
        if self.timeout is not None and not isinstance(self.timeout, (int, float)):
            errors.append("MergeParameters.timeout must be a number")

        return len(errors) == 0, errors

# Base Node Class

class BaseNode(BaseModel):
    model_config = ConfigDict(extra="allow")
    """Base node class with common fields."""
    id: str  # Unique identifier for the node within the workflow
    name: str  # Human-readable node name
    trigger: bool  # Whether this node initiates workflow execution
    output: dict[str, Any]  # Placeholder for execution output (empty in definition)
    error: Optional[ErrorHandling] = None  # Error handling configuration
    credential_type: Optional[list[str]] = None  # List of allowed credential types for this node (for UI filtering)
    credentials: Optional[Credential] = None  # Complete credential object with values

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.id is None:
            errors.append("BaseNode.id is required")
        if self.id is not None and not isinstance(self.id, str):
            errors.append("BaseNode.id must be a string")
        if self.name is None:
            errors.append("BaseNode.name is required")
        if self.name is not None and not isinstance(self.name, str):
            errors.append("BaseNode.name must be a string")
        if self.trigger is None:
            errors.append("BaseNode.trigger is required")
        if self.trigger is not None and not isinstance(self.trigger, bool):
            errors.append("BaseNode.trigger must be a boolean")
        if self.output is None:
            errors.append("BaseNode.output is required")

        return len(errors) == 0, errors

# Specific Node Classes

class ManualTriggerNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Manual workflow trigger"""
    type_: Literal["ManualTrigger"] = Field(default="ManualTrigger", alias="type")
    parameters: dict[str, Any]
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"ManualTriggerNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class ScheduledTriggerNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Scheduled workflow trigger with interval-based execution"""
    type_: Literal["ScheduledTrigger"] = Field(default="ScheduledTrigger", alias="type")
    parameters: ScheduledtriggerParameters
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"ScheduledTriggerNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class HttpNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """HTTP request node"""
    type_: Literal["http"] = Field(default="http", alias="type")
    parameters: HttpParameters
    credential_type: Optional[list[str]] = ["api_key", "oauth2", "basic_auth", "header", "token"]

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"HttpNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class SmtpNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Send email via SMTP"""
    type_: Literal["smtp"] = Field(default="smtp", alias="type")
    parameters: SmtpParameters
    credential_type: Optional[list[str]] = ["smtp"]

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"SmtpNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class ConditionalNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """If/else branching based on boolean expression"""
    type_: Literal["conditional"] = Field(default="conditional", alias="type")
    parameters: ConditionalParameters
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"ConditionalNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class SwitchNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Multi-way branching based on multiple rules"""
    type_: Literal["switch"] = Field(default="switch", alias="type")
    parameters: SwitchParameters
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"SwitchNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class LogNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Log information during workflow execution"""
    type_: Literal["log"] = Field(default="log", alias="type")
    parameters: LogParameters
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"LogNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class DatetimenowNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Get the current date and time in a given timezone"""
    type_: Literal["dateTimeNow"] = Field(default="dateTimeNow", alias="type")
    parameters: DatetimenowParameters
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"DatetimenowNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class DatetimeaddNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Add a duration to a date or timestamp"""
    type_: Literal["dateTimeAdd"] = Field(default="dateTimeAdd", alias="type")
    parameters: DatetimeaddParameters
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"DatetimeaddNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class DatetimesubtractNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Subtract a duration from a date or timestamp"""
    type_: Literal["dateTimeSubtract"] = Field(default="dateTimeSubtract", alias="type")
    parameters: DatetimesubtractParameters
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"DatetimesubtractNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class DatetimeformatNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Format a date or timestamp in a chosen timezone"""
    type_: Literal["dateTimeFormat"] = Field(default="dateTimeFormat", alias="type")
    parameters: DatetimeformatParameters
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"DatetimeformatNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class DatetimeparseNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Parse a date or timestamp into structured components"""
    type_: Literal["dateTimeParse"] = Field(default="dateTimeParse", alias="type")
    parameters: DatetimeparseParameters
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"DatetimeparseNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class AgentNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """AI agent node"""
    type_: Literal["agent"] = Field(default="agent", alias="type")
    parameters: dict[str, Any]
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"AgentNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class WaitNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Wait for a specified duration"""
    type_: Literal["wait"] = Field(default="wait", alias="type")
    parameters: WaitParameters
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"WaitNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class EditNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Data transformation node"""
    type_: Literal["edit"] = Field(default="edit", alias="type")
    parameters: EditParameters
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"EditNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class FilterNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Keep only list items that match one or more rules"""
    type_: Literal["filter"] = Field(default="filter", alias="type")
    parameters: FilterParameters
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"FilterNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class SortNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Order a list using one or more sort rules"""
    type_: Literal["sort"] = Field(default="sort", alias="type")
    parameters: SortParameters
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"SortNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class LimitNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Keep only the first items from a list"""
    type_: Literal["limit"] = Field(default="limit", alias="type")
    parameters: LimitParameters
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"LimitNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class SplitNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Split array into individual items (Fan-Out)"""
    type_: Literal["split"] = Field(default="split", alias="type")
    parameters: SplitParameters
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"SplitNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class AggregatorNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Aggregate items back into array (Gather)"""
    type_: Literal["aggregator"] = Field(default="aggregator", alias="type")
    parameters: dict[str, Any]
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"AggregatorNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

class MergeNode(BaseNode):
    model_config = ConfigDict(extra="allow")
    """Merge multiple execution branches"""
    type_: Literal["merge"] = Field(default="merge", alias="type")
    parameters: MergeParameters
    credential_type: Optional[list[str]] = None

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the node including parameters."""
        errors: list[str] = []

        # Validate base fields
        base_valid, base_errors = super().sanitize()
        if not base_valid:
            errors.extend(base_errors)

        # Validate parameters
        if hasattr(self.parameters, "sanitize"):
            params_valid, params_errors = self.parameters.sanitize()
            if not params_valid:
                errors.extend(params_errors)

        # Validate credential type matches
        if self.credentials and self.credential_type:
            if self.credentials.type_ not in self.credential_type:
                errors.append(f"MergeNode.credentials.type must be one of {self.credential_type}")

        return len(errors) == 0, errors

# Union type for all nodes

Node = Union[ManualTriggerNode, ScheduledTriggerNode, HttpNode, SmtpNode, ConditionalNode, SwitchNode, LogNode, DatetimenowNode, DatetimeaddNode, DatetimesubtractNode, DatetimeformatNode, DatetimeparseNode, AgentNode, WaitNode, EditNode, FilterNode, SortNode, LimitNode, SplitNode, AggregatorNode, MergeNode]
