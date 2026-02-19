// Auto-generated DSL type definitions
// DO NOT EDIT - Generated from dsl/dsl-definition.json

// Core Structures

export interface Workflow {
  // Root workflow structure
  workflow_id: string;  // Unique identifier for the workflow definition
  execution_id: string;  // Unique identifier for this specific execution instance
  nodes: Node[];  // Array of node definitions
  edges: Edge[];  // Array of edge definitions
}

export function sanitizeWorkflow(obj: Workflow): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (obj.workflow_id === undefined || obj.workflow_id === null) {
    errors.push("Workflow.workflow_id is required");
  }
  if (obj.workflow_id !== undefined && typeof obj.workflow_id !== "string") {
    errors.push("Workflow.workflow_id must be a string");
  }
  if (obj.execution_id === undefined || obj.execution_id === null) {
    errors.push("Workflow.execution_id is required");
  }
  if (obj.execution_id !== undefined && typeof obj.execution_id !== "string") {
    errors.push("Workflow.execution_id must be a string");
  }
  if (obj.nodes === undefined || obj.nodes === null) {
    errors.push("Workflow.nodes is required");
  }
  if (obj.edges === undefined || obj.edges === null) {
    errors.push("Workflow.edges is required");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export interface Node {
  // Single executable node within the workflow
  id: string;  // Unique identifier for the node within the workflow
  name: string;  // Human-readable node name
  trigger: boolean;  // Whether this node initiates workflow execution
  type: "ManualTrigger" | "http" | "smtp" | "conditional" | "switch" | "log" | "agent" | "wait" | "edit" | "split" | "aggregator" | "merge";  // Node type identifier
  parameters: Record<string, any>;  // Type-specific configuration (may be empty)
  output: Record<string, any>;  // Placeholder for execution output (empty in definition)
  credentials: Credential | undefined;  // Complete credential object with values
  error: ErrorHandling | undefined;  // Error handling configuration
}

export function sanitizeNode(obj: Node): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (obj.id === undefined || obj.id === null) {
    errors.push("Node.id is required");
  }
  if (obj.id !== undefined && typeof obj.id !== "string") {
    errors.push("Node.id must be a string");
  }
  if (obj.name === undefined || obj.name === null) {
    errors.push("Node.name is required");
  }
  if (obj.name !== undefined && typeof obj.name !== "string") {
    errors.push("Node.name must be a string");
  }
  if (obj.trigger === undefined || obj.trigger === null) {
    errors.push("Node.trigger is required");
  }
  if (obj.trigger !== undefined && typeof obj.trigger !== "boolean") {
    errors.push("Node.trigger must be a boolean");
  }
  if (obj.type === undefined || obj.type === null) {
    errors.push("Node.type is required");
  }
  if (obj.type !== undefined && typeof obj.type !== "string") {
    errors.push("Node.type must be a string");
  }
  if (obj.parameters === undefined || obj.parameters === null) {
    errors.push("Node.parameters is required");
  }
  if (obj.output === undefined || obj.output === null) {
    errors.push("Node.output is required");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export interface Edge {
  // Connection between two nodes
  id: string;  // Unique identifier for the edge
  src: string;  // Source node ID
  dst: string;  // Destination node ID
}

export function sanitizeEdge(obj: Edge): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (obj.id === undefined || obj.id === null) {
    errors.push("Edge.id is required");
  }
  if (obj.id !== undefined && typeof obj.id !== "string") {
    errors.push("Edge.id must be a string");
  }
  if (obj.src === undefined || obj.src === null) {
    errors.push("Edge.src is required");
  }
  if (obj.src !== undefined && typeof obj.src !== "string") {
    errors.push("Edge.src must be a string");
  }
  if (obj.dst === undefined || obj.dst === null) {
    errors.push("Edge.dst is required");
  }
  if (obj.dst !== undefined && typeof obj.dst !== "string") {
    errors.push("Edge.dst must be a string");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export interface Credential {
  // Credential object with sensitive values
  id: string;  // Unique credential identifier
  name: string;  // Human-readable credential name
  type: "api_key" | "oauth2" | "basic_auth" | "header" | "token" | "custom" | "smtp";  // Credential type identifier
  values: Record<string, any>;  // Type-specific credential values (actual secrets)
}

export function sanitizeCredential(obj: Credential): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (obj.id === undefined || obj.id === null) {
    errors.push("Credential.id is required");
  }
  if (obj.id !== undefined && typeof obj.id !== "string") {
    errors.push("Credential.id must be a string");
  }
  if (obj.name === undefined || obj.name === null) {
    errors.push("Credential.name is required");
  }
  if (obj.name !== undefined && typeof obj.name !== "string") {
    errors.push("Credential.name must be a string");
  }
  if (obj.type === undefined || obj.type === null) {
    errors.push("Credential.type is required");
  }
  if (obj.type !== undefined && typeof obj.type !== "string") {
    errors.push("Credential.type must be a string");
  }
  if (obj.values === undefined || obj.values === null) {
    errors.push("Credential.values is required");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export interface ErrorHandling {
  // Error handling configuration
  type: "halt" | "ignore" | "branch";  // Error handling strategy
  error_edge: string | undefined;  // Edge ID to follow on error (required if type is 'branch')
}

export function sanitizeErrorHandling(obj: ErrorHandling): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (obj.type === undefined || obj.type === null) {
    errors.push("ErrorHandling.type is required");
  }
  if (obj.type !== undefined && typeof obj.type !== "string") {
    errors.push("ErrorHandling.type must be a string");
  }
  if (obj.error_edge !== undefined && typeof obj.error_edge !== "string") {
    errors.push("ErrorHandling.error_edge must be a string");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Nested Types

export interface SwitchRule {
  // Switch rule definition
  value: string;  // Value to compare (supports template variables)
  operator: "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains";  // Comparison operator
  compare: string;  // Value to compare against
}

export function sanitizeSwitchRule(obj: SwitchRule): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (obj.value === undefined || obj.value === null) {
    errors.push("SwitchRule.value is required");
  }
  if (obj.value !== undefined && typeof obj.value !== "string") {
    errors.push("SwitchRule.value must be a string");
  }
  if (obj.operator === undefined || obj.operator === null) {
    errors.push("SwitchRule.operator is required");
  }
  if (obj.operator !== undefined && typeof obj.operator !== "string") {
    errors.push("SwitchRule.operator must be a string");
  }
  if (obj.compare === undefined || obj.compare === null) {
    errors.push("SwitchRule.compare is required");
  }
  if (obj.compare !== undefined && typeof obj.compare !== "string") {
    errors.push("SwitchRule.compare must be a string");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export interface EditAssignment {
  // Edit node assignment
  name: string;  // The key to set (supports dot-notation for nested objects)
  value: string;  // The value to assign (supports dynamic expressions)
  type: "string" | "number" | "boolean" | "json" | undefined;  // Target type casting
}

export function sanitizeEditAssignment(obj: EditAssignment): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (obj.name === undefined || obj.name === null) {
    errors.push("EditAssignment.name is required");
  }
  if (obj.name !== undefined && typeof obj.name !== "string") {
    errors.push("EditAssignment.name must be a string");
  }
  if (obj.value === undefined || obj.value === null) {
    errors.push("EditAssignment.value is required");
  }
  if (obj.value !== undefined && typeof obj.value !== "string") {
    errors.push("EditAssignment.value must be a string");
  }
  if (obj.type !== undefined && typeof obj.type !== "string") {
    errors.push("EditAssignment.type must be a string");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Node Parameter Types

export interface HttpParameters {
  // HTTP request node
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";  // HTTP method
  url: string;  // Target URL (supports template variables)
  body: any | undefined;  // Request body (JSON)
  query: Record<string, any> | undefined;  // URL query parameters as key-value pairs
  headers: Record<string, any> | undefined;  // HTTP headers as key-value pairs
  retry: string | undefined;  // Number of retry attempts
  retry_delay: string | undefined;  // Delay between retries in seconds
  timeout: string | undefined;  // Request timeout in seconds
  raise_on_status: string | undefined;  // Comma-separated status code patterns to treat as errors
  ignore_ssl: boolean | undefined;  // Whether to ignore SSL certificate validation
}

export function sanitizeHttpParameters(obj: HttpParameters): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (obj.method === undefined || obj.method === null) {
    errors.push("HttpParameters.method is required");
  }
  if (obj.method !== undefined && typeof obj.method !== "string") {
    errors.push("HttpParameters.method must be a string");
  }
  if (obj.url === undefined || obj.url === null) {
    errors.push("HttpParameters.url is required");
  }
  if (obj.url !== undefined && typeof obj.url !== "string") {
    errors.push("HttpParameters.url must be a string");
  }
  if (obj.retry !== undefined && typeof obj.retry !== "string") {
    errors.push("HttpParameters.retry must be a string");
  }
  if (obj.retry_delay !== undefined && typeof obj.retry_delay !== "string") {
    errors.push("HttpParameters.retry_delay must be a string");
  }
  if (obj.timeout !== undefined && typeof obj.timeout !== "string") {
    errors.push("HttpParameters.timeout must be a string");
  }
  if (obj.raise_on_status !== undefined && typeof obj.raise_on_status !== "string") {
    errors.push("HttpParameters.raise_on_status must be a string");
  }
  if (obj.ignore_ssl !== undefined && typeof obj.ignore_ssl !== "boolean") {
    errors.push("HttpParameters.ignore_ssl must be a boolean");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export interface SmtpParameters {
  // Send email via SMTP
  subject: string;  // Email subject line
  body: string;  // Email body content (plain text or HTML)
  to: string[];  // Primary recipient email addresses
  from: string;  // Sender email address
  cc: string[] | undefined;  // Carbon copy recipients
  bcc: string[] | undefined;  // Blind carbon copy recipients
}

export function sanitizeSmtpParameters(obj: SmtpParameters): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (obj.subject === undefined || obj.subject === null) {
    errors.push("SmtpParameters.subject is required");
  }
  if (obj.subject !== undefined && typeof obj.subject !== "string") {
    errors.push("SmtpParameters.subject must be a string");
  }
  if (obj.body === undefined || obj.body === null) {
    errors.push("SmtpParameters.body is required");
  }
  if (obj.body !== undefined && typeof obj.body !== "string") {
    errors.push("SmtpParameters.body must be a string");
  }
  if (obj.to === undefined || obj.to === null) {
    errors.push("SmtpParameters.to is required");
  }
  if (obj.from === undefined || obj.from === null) {
    errors.push("SmtpParameters.from is required");
  }
  if (obj.from !== undefined && typeof obj.from !== "string") {
    errors.push("SmtpParameters.from must be a string");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export interface ConditionalParameters {
  // If/else branching based on boolean expression
  expression: string;  // Boolean expression to evaluate (supports template variables)
}

export function sanitizeConditionalParameters(obj: ConditionalParameters): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (obj.expression === undefined || obj.expression === null) {
    errors.push("ConditionalParameters.expression is required");
  }
  if (obj.expression !== undefined && typeof obj.expression !== "string") {
    errors.push("ConditionalParameters.expression must be a string");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export interface SwitchParameters {
  // Multi-way branching based on multiple rules
  rules: SwitchRule[];  // Array of switch rules
}

export function sanitizeSwitchParameters(obj: SwitchParameters): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (obj.rules === undefined || obj.rules === null) {
    errors.push("SwitchParameters.rules is required");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export interface LogParameters {
  // Log information during workflow execution
  message: string;  // Message to log (supports context variables)
  level: "debug" | "info" | "warn" | "error" | undefined;  // Log level
}

export function sanitizeLogParameters(obj: LogParameters): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (obj.message === undefined || obj.message === null) {
    errors.push("LogParameters.message is required");
  }
  if (obj.message !== undefined && typeof obj.message !== "string") {
    errors.push("LogParameters.message must be a string");
  }
  if (obj.level !== undefined && typeof obj.level !== "string") {
    errors.push("LogParameters.level must be a string");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export interface WaitParameters {
  // Wait for a specified duration
  amount: number;  // Quantity of time
  unit: "seconds" | "minutes" | "hours" | "days";  // Unit of time
}

export function sanitizeWaitParameters(obj: WaitParameters): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (obj.amount === undefined || obj.amount === null) {
    errors.push("WaitParameters.amount is required");
  }
  if (obj.amount !== undefined && typeof obj.amount !== "number") {
    errors.push("WaitParameters.amount must be a number");
  }
  if (obj.unit === undefined || obj.unit === null) {
    errors.push("WaitParameters.unit is required");
  }
  if (obj.unit !== undefined && typeof obj.unit !== "string") {
    errors.push("WaitParameters.unit must be a string");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export interface EditParameters {
  // Data transformation node
  mode: "assignments" | "keep_only" | undefined;  // Transformation mode
  assignments: EditAssignment[] | undefined;  // List of field operations
}

export function sanitizeEditParameters(obj: EditParameters): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (obj.mode !== undefined && typeof obj.mode !== "string") {
    errors.push("EditParameters.mode must be a string");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export interface SplitParameters {
  // Split array into individual items (Fan-Out)
  input_array: string;  // Dynamic reference to the array (e.g., {{ $node.Http.body.users }})
}

export function sanitizeSplitParameters(obj: SplitParameters): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (obj.input_array === undefined || obj.input_array === null) {
    errors.push("SplitParameters.input_array is required");
  }
  if (obj.input_array !== undefined && typeof obj.input_array !== "string") {
    errors.push("SplitParameters.input_array must be a string");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export interface MergeParameters {
  // Merge multiple execution branches
  wait_mode: "wait_for_all" | "wait_for_any" | undefined;  // Synchronization mode
  timeout: number | undefined;  // Safety timeout in seconds
}

export function sanitizeMergeParameters(obj: MergeParameters): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (obj.wait_mode !== undefined && typeof obj.wait_mode !== "string") {
    errors.push("MergeParameters.wait_mode must be a string");
  }
  if (obj.timeout !== undefined && typeof obj.timeout !== "number") {
    errors.push("MergeParameters.timeout must be a number");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Node Types with Credential Type

export const MANUALTRIGGER_CREDENTIAL_TYPE: null = null;
export const HTTP_CREDENTIAL_TYPE: ("api_key", "oauth2", "basic_auth", "header", "token") | null = ("api_key", "oauth2", "basic_auth", "header", "token");
export const SMTP_CREDENTIAL_TYPE: ("smtp") | null = ("smtp");
export const CONDITIONAL_CREDENTIAL_TYPE: null = null;
export const SWITCH_CREDENTIAL_TYPE: null = null;
export const LOG_CREDENTIAL_TYPE: null = null;
export const AGENT_CREDENTIAL_TYPE: null = null;
export const WAIT_CREDENTIAL_TYPE: null = null;
export const EDIT_CREDENTIAL_TYPE: null = null;
export const SPLIT_CREDENTIAL_TYPE: null = null;
export const AGGREGATOR_CREDENTIAL_TYPE: null = null;
export const MERGE_CREDENTIAL_TYPE: null = null;
