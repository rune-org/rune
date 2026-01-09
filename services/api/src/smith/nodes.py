from pydantic import BaseModel, Field
from typing import Optional, Literal


class SwitchRule(BaseModel):
    """A single rule for switch nodes."""

    value: str = Field(..., description="Variable or value to evaluate")
    operator: Literal["<", ">", "==", "!=", "<=", ">=", "contains"] = Field(
        ..., description="Comparison operator"
    )
    compare: str = Field(..., description="Variable or value to compare against")


class TriggerArgs(BaseModel):
    """Arguments for creating a trigger node."""

    node_type: Literal["ManualTrigger"] = Field(
        default="ManualTrigger", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )


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


class ConditionalArgs(BaseModel):
    """Arguments for creating a conditional node."""

    node_type: Literal["conditional"] = Field(
        default="conditional", description="Node type"
    )
    name: str = Field(
        ..., description="Node name (needs to be short, informative, without spaces)"
    )
    expression: Optional[str] = Field(
        default=None,
        description="Boolean expression to evaluate (e.g., 'status == 200')",
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
