// Auto-generated DSL type definitions
// DO NOT EDIT - Generated from dsl/dsl-definition.json

package dsl

// Core Structures

type Workflow struct {
  // Root workflow structure
  WorkflowId string `json:"workflow_id"`  // Unique identifier for the workflow definition
  ExecutionId string `json:"execution_id"`  // Unique identifier for this specific execution instance
  Nodes []Node `json:"nodes"`  // Array of node definitions
  Edges []Edge `json:"edges"`  // Array of edge definitions
}

func (n *Workflow) Sanitize() (bool, []string) {
  var errors []string

  if n.WorkflowId == "" {
    errors = append(errors, "Workflow.workflow_id is required")
  }
  if n.ExecutionId == "" {
    errors = append(errors, "Workflow.execution_id is required")
  }
  if n.Nodes == nil || len(n.Nodes) == 0 {
    errors = append(errors, "Workflow.nodes is required")
  }
  if n.Edges == nil || len(n.Edges) == 0 {
    errors = append(errors, "Workflow.edges is required")
  }

  return len(errors) == 0, errors
}

type Node struct {
  // Single executable node within the workflow
  Id string `json:"id"`  // Unique identifier for the node within the workflow
  Name string `json:"name"`  // Human-readable node name
  Trigger bool `json:"trigger"`  // Whether this node initiates workflow execution
  Type string `json:"type"`  // Node type identifier
  Parameters map[string]interface{} `json:"parameters"`  // Type-specific configuration (may be empty)
  Output map[string]interface{} `json:"output"`  // Placeholder for execution output (empty in definition)
  Credentials *Credential `json:"credentials"`  // Complete credential object with values
  Error *ErrorHandling `json:"error"`  // Error handling configuration
}

func (n *Node) Sanitize() (bool, []string) {
  var errors []string

  if n.Id == "" {
    errors = append(errors, "Node.id is required")
  }
  if n.Name == "" {
    errors = append(errors, "Node.name is required")
  }
  if n.Type == "" {
    errors = append(errors, "Node.type is required")
  }
  if n.Parameters == nil {
    errors = append(errors, "Node.parameters is required")
  }
  if n.Output == nil {
    errors = append(errors, "Node.output is required")
  }

  return len(errors) == 0, errors
}

type Edge struct {
  // Connection between two nodes
  Id string `json:"id"`  // Unique identifier for the edge
  Src string `json:"src"`  // Source node ID
  Dst string `json:"dst"`  // Destination node ID
}

func (n *Edge) Sanitize() (bool, []string) {
  var errors []string

  if n.Id == "" {
    errors = append(errors, "Edge.id is required")
  }
  if n.Src == "" {
    errors = append(errors, "Edge.src is required")
  }
  if n.Dst == "" {
    errors = append(errors, "Edge.dst is required")
  }

  return len(errors) == 0, errors
}

type Credential struct {
  // Credential object with sensitive values
  Id string `json:"id"`  // Unique credential identifier
  Name string `json:"name"`  // Human-readable credential name
  Type string `json:"type"`  // Credential type identifier
  Values map[string]interface{} `json:"values"`  // Type-specific credential values (actual secrets)
}

func (n *Credential) Sanitize() (bool, []string) {
  var errors []string

  if n.Id == "" {
    errors = append(errors, "Credential.id is required")
  }
  if n.Name == "" {
    errors = append(errors, "Credential.name is required")
  }
  if n.Type == "" {
    errors = append(errors, "Credential.type is required")
  }
  if n.Values == nil {
    errors = append(errors, "Credential.values is required")
  }

  return len(errors) == 0, errors
}

type ErrorHandling struct {
  // Error handling configuration
  Type string `json:"type"`  // Error handling strategy
  ErrorEdge *string `json:"error_edge"`  // Edge ID to follow on error (required if type is 'branch')
}

func (n *ErrorHandling) Sanitize() (bool, []string) {
  var errors []string

  if n.Type == "" {
    errors = append(errors, "ErrorHandling.type is required")
  }

  return len(errors) == 0, errors
}

// Nested Types

type SwitchRule struct {
  // Switch rule definition
  Value string `json:"value"`  // Value to compare (supports template variables)
  Operator string `json:"operator"`  // Comparison operator
  Compare string `json:"compare"`  // Value to compare against
}

func (n *SwitchRule) Sanitize() (bool, []string) {
  var errors []string

  if n.Value == "" {
    errors = append(errors, "SwitchRule.value is required")
  }
  if n.Operator == "" {
    errors = append(errors, "SwitchRule.operator is required")
  }
  if n.Compare == "" {
    errors = append(errors, "SwitchRule.compare is required")
  }

  return len(errors) == 0, errors
}

type EditAssignment struct {
  // Edit node assignment
  Name string `json:"name"`  // The key to set (supports dot-notation for nested objects)
  Value string `json:"value"`  // The value to assign (supports dynamic expressions)
  Type *string `json:"type"`  // Target type casting
}

func (n *EditAssignment) Sanitize() (bool, []string) {
  var errors []string

  if n.Name == "" {
    errors = append(errors, "EditAssignment.name is required")
  }
  if n.Value == "" {
    errors = append(errors, "EditAssignment.value is required")
  }

  return len(errors) == 0, errors
}

// Node Parameter Types

type HttpParameters struct {
  // HTTP request node
  Method string `json:"method"`  // HTTP method
  Url string `json:"url"`  // Target URL (supports template variables)
  Body *interface{} `json:"body"`  // Request body (JSON)
  Query *map[string]interface{} `json:"query"`  // URL query parameters as key-value pairs
  Headers *map[string]interface{} `json:"headers"`  // HTTP headers as key-value pairs
  Retry *string `json:"retry"`  // Number of retry attempts
  RetryDelay *string `json:"retry_delay"`  // Delay between retries in seconds
  Timeout *string `json:"timeout"`  // Request timeout in seconds
  RaiseOnStatus *string `json:"raise_on_status"`  // Comma-separated status code patterns to treat as errors
  IgnoreSsl *bool `json:"ignore_ssl"`  // Whether to ignore SSL certificate validation
}

func (n *HttpParameters) Sanitize() (bool, []string) {
  var errors []string

  if n.Method == "" {
    errors = append(errors, "HttpParameters.method is required")
  }
  if n.Url == "" {
    errors = append(errors, "HttpParameters.url is required")
  }

  return len(errors) == 0, errors
}

type SmtpParameters struct {
  // Send email via SMTP
  Subject string `json:"subject"`  // Email subject line
  Body string `json:"body"`  // Email body content (plain text or HTML)
  To []string `json:"to"`  // Primary recipient email addresses
  From string `json:"from"`  // Sender email address
  Cc *[]string `json:"cc"`  // Carbon copy recipients
  Bcc *[]string `json:"bcc"`  // Blind carbon copy recipients
}

func (n *SmtpParameters) Sanitize() (bool, []string) {
  var errors []string

  if n.Subject == "" {
    errors = append(errors, "SmtpParameters.subject is required")
  }
  if n.Body == "" {
    errors = append(errors, "SmtpParameters.body is required")
  }
  if n.To == nil || len(n.To) == 0 {
    errors = append(errors, "SmtpParameters.to is required")
  }
  if n.From == "" {
    errors = append(errors, "SmtpParameters.from is required")
  }

  return len(errors) == 0, errors
}

type ConditionalParameters struct {
  // If/else branching based on boolean expression
  Expression string `json:"expression"`  // Boolean expression to evaluate (supports template variables)
}

func (n *ConditionalParameters) Sanitize() (bool, []string) {
  var errors []string

  if n.Expression == "" {
    errors = append(errors, "ConditionalParameters.expression is required")
  }

  return len(errors) == 0, errors
}

type SwitchParameters struct {
  // Multi-way branching based on multiple rules
  Rules []SwitchRule `json:"rules"`  // Array of switch rules
}

func (n *SwitchParameters) Sanitize() (bool, []string) {
  var errors []string

  if n.Rules == nil || len(n.Rules) == 0 {
    errors = append(errors, "SwitchParameters.rules is required")
  }

  return len(errors) == 0, errors
}

type LogParameters struct {
  // Log information during workflow execution
  Message string `json:"message"`  // Message to log (supports context variables)
  Level *string `json:"level"`  // Log level
}

func (n *LogParameters) Sanitize() (bool, []string) {
  var errors []string

  if n.Message == "" {
    errors = append(errors, "LogParameters.message is required")
  }

  return len(errors) == 0, errors
}

type WaitParameters struct {
  // Wait for a specified duration
  Amount float64 `json:"amount"`  // Quantity of time
  Unit string `json:"unit"`  // Unit of time
}

func (n *WaitParameters) Sanitize() (bool, []string) {
  var errors []string

  if n.Unit == "" {
    errors = append(errors, "WaitParameters.unit is required")
  }

  return len(errors) == 0, errors
}

type EditParameters struct {
  // Data transformation node
  Mode *string `json:"mode"`  // Transformation mode
  Assignments *[]EditAssignment `json:"assignments"`  // List of field operations
}

func (n *EditParameters) Sanitize() (bool, []string) {
  var errors []string


  return len(errors) == 0, errors
}

type SplitParameters struct {
  // Split array into individual items (Fan-Out)
  InputArray string `json:"input_array"`  // Dynamic reference to the array (e.g., {{ $node.Http.body.users }})
}

func (n *SplitParameters) Sanitize() (bool, []string) {
  var errors []string

  if n.InputArray == "" {
    errors = append(errors, "SplitParameters.input_array is required")
  }

  return len(errors) == 0, errors
}

type MergeParameters struct {
  // Merge multiple execution branches
  WaitMode *string `json:"wait_mode"`  // Synchronization mode
  Timeout *float64 `json:"timeout"`  // Safety timeout in seconds
}

func (n *MergeParameters) Sanitize() (bool, []string) {
  var errors []string


  return len(errors) == 0, errors
}

// Node Credential Types

var MANUALTRIGGER_CREDENTIAL_TYPE []string = nil
var HTTP_CREDENTIAL_TYPE []string = []string{"api_key", "oauth2", "basic_auth", "header", "token"}
var SMTP_CREDENTIAL_TYPE []string = []string{"smtp"}
var CONDITIONAL_CREDENTIAL_TYPE []string = nil
var SWITCH_CREDENTIAL_TYPE []string = nil
var LOG_CREDENTIAL_TYPE []string = nil
var AGENT_CREDENTIAL_TYPE []string = nil
var WAIT_CREDENTIAL_TYPE []string = nil
var EDIT_CREDENTIAL_TYPE []string = nil
var SPLIT_CREDENTIAL_TYPE []string = nil
var AGGREGATOR_CREDENTIAL_TYPE []string = nil
var MERGE_CREDENTIAL_TYPE []string = nil
