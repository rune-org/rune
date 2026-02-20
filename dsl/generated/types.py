"""Auto-generated DSL type definitions.

DO NOT EDIT - Generated from dsl/dsl-definition.json
"""

from typing import Any, Optional, Literal, Union
from pydantic import BaseModel, Field

# Core Structures

class Workflow(BaseModel):
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
    """Credential object with sensitive values"""
    id: str  # Unique credential identifier
    name: str  # Human-readable credential name
    type_: Literal["api_key", "oauth2", "basic_auth", "header", "token", "custom", "smtp"] = Field(alias="type")  # Credential type identifier
    values: dict[str, Any]  # Type-specific credential values (actual secrets)

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
        if self.values is None:
            errors.append("Credential.values is required")

        return len(errors) == 0, errors

class ErrorHandling(BaseModel):
    """Error handling configuration"""
    type_: Literal["halt", "ignore", "branch"] = Field(alias="type")  # Error handling strategy
    error_edge: Optional[str]  # Edge ID to follow on error (required if type is 'branch')

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

class EditAssignment(BaseModel):
    """Edit node assignment"""
    name: str  # The key to set (supports dot-notation for nested objects)
    value: str  # The value to assign (supports dynamic expressions)
    type_: Optional[Literal["string", "number", "boolean", "json"]] = Field(alias="type")  # Target type casting

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

class HttpParameters(BaseModel):
    """HTTP request node"""
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"]  # HTTP method
    url: str  # Target URL (supports template variables)
    body: Optional[Any]  # Request body (JSON)
    query: Optional[dict[str, Any]]  # URL query parameters as key-value pairs
    headers: Optional[dict[str, Any]]  # HTTP headers as key-value pairs
    retry: Optional[str]  # Number of retry attempts
    retry_delay: Optional[str]  # Delay between retries in seconds
    timeout: Optional[str]  # Request timeout in seconds
    raise_on_status: Optional[str]  # Comma-separated status code patterns to treat as errors
    ignore_ssl: Optional[bool]  # Whether to ignore SSL certificate validation

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
    """Send email via SMTP"""
    subject: str  # Email subject line
    body: str  # Email body content (plain text or HTML)
    to: list[str]  # Primary recipient email addresses
    from_: str = Field(alias="from")  # Sender email address
    cc: Optional[list[str]]  # Carbon copy recipients
    bcc: Optional[list[str]]  # Blind carbon copy recipients

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
    """Multi-way branching based on multiple rules"""
    rules: list[SwitchRule]  # Array of switch rules

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.rules is None:
            errors.append("SwitchParameters.rules is required")

        return len(errors) == 0, errors

class LogParameters(BaseModel):
    """Log information during workflow execution"""
    message: str  # Message to log (supports context variables)
    level: Optional[Literal["debug", "info", "warn", "error"]]  # Log level

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

class WaitParameters(BaseModel):
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
    """Data transformation node"""
    mode: Optional[Literal["assignments", "keep_only"]]  # Transformation mode
    assignments: Optional[list[EditAssignment]]  # List of field operations

    def sanitize(self) -> tuple[bool, list[str]]:
        """Validate and sanitize the object."""
        errors: list[str] = []

        if self.mode is not None and not isinstance(self.mode, str):
            errors.append("EditParameters.mode must be a string")

        return len(errors) == 0, errors

class SplitParameters(BaseModel):
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
    """Merge multiple execution branches"""
    wait_mode: Optional[Literal["wait_for_all", "wait_for_any"]]  # Synchronization mode
    timeout: Optional[float]  # Safety timeout in seconds

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
    """Base node class with common fields."""
    id: str  # Unique identifier for the node within the workflow
    name: str  # Human-readable node name
    trigger: bool  # Whether this node initiates workflow execution
    output: dict[str, Any]  # Placeholder for execution output (empty in definition)
    error: Optional[ErrorHandling]  # Error handling configuration
    credential_type: Optional[list[str]]  # List of allowed credential types for this node (for UI filtering)
    credentials: Optional[Credential]  # Complete credential object with values

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

class HttpNode(BaseNode):
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

class AgentNode(BaseNode):
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

class SplitNode(BaseNode):
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

Node = Union[ManualTriggerNode, HttpNode, SmtpNode, ConditionalNode, SwitchNode, LogNode, AgentNode, WaitNode, EditNode, SplitNode, AggregatorNode, MergeNode]
