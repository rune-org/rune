package dsl

// Workflow models a workflow execution structure sent from the master service.
// It contains only the essential execution data: nodes to execute and their connections.
// Metadata like name, description, and active status are NOT included as they're stored in the master service.
// Trigger nodes are NOT executed in this service - triggers fire in the master and send their data via context.
type Workflow struct {
	WorkflowID  string          `json:"workflow_id"`
	ExecutionID string          `json:"execution_id"`
	Nodes       []Node          `json:"nodes"`
	Edges       []Edge          `json:"edges"`
}

// Node represents a single executable node within the workflow.
// Trigger nodes are included in the structure for graph completeness but are never executed in this service.
// The master service handles trigger execution and sends the resulting data in the execution context.
type Node struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Trigger     bool           `json:"trigger"` // Marks trigger nodes (NOT executed here, only for graph structure)
	Type        string         `json:"type"`
	Parameters  map[string]any `json:"parameters"`
	Credentials *Credential `json:"credentials,omitempty"`
	Output      map[string]any `json:"output"`
	Error       *ErrorHandling `json:"error,omitempty"`
}

// Edge connects two nodes in the workflow graph.
// It defines the flow of data and control between nodes.
type Edge struct {
	ID      string `json:"id"`
	Src     string `json:"src"`
	Dst     string `json:"dst"`
}

// Credential references a credential definition by type, ID, and name.
type Credential struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Type   string `json:"type"` // e.g., "smtp", "api_key", "oauth2", "username_password"
	Values map[string]any `json:"values"` // Actual credential values, e.g., username, password
}

// ErrorHandling defines how errors should be handled when a node fails.
type ErrorHandling struct {
	Type      string `json:"type"`       // "halt", "ignore", or "branch"
	ErrorEdge string `json:"error_edge"` // Edge ID to follow on error if type is "branch"
}

// HTTPParameters defines configuration for HTTP request nodes.
type HTTPParameters struct {
	Method        string            `json:"method"`
	URL           string            `json:"url"`
	Body          any               `json:"body"` // JSON body, can be any type
	Query         map[string]string `json:"query"`
	Headers       map[string]string `json:"headers"`
	Retry         int               `json:"retry,string"`
	RetryDelay    int               `json:"retry_delay,string"`
	Timeout       int               `json:"timeout,string"`
	RaiseOnStatus string            `json:"raise_on_status"` // e.g., "4xx or 5xx"
	IgnoreSSL     bool              `json:"ignore_ssl"`
}

// ConditionalParameters defines configuration for conditional branching nodes.
type ConditionalParameters struct {
	Expressions []Expression `json:"expression"`
	Operator    string       `json:"operator"` // "and" or "or"
	TrueEdgeID  string       `json:"true_edge_id"`
	FalseEdgeID string       `json:"false_edge_id"`
}

// Expression represents a single conditional expression with two operands and an operator.
type Expression struct {
	Op1      any    `json:"op1"`      // First operand, can be any type
	Op2      any    `json:"op2"`      // Second operand, can be any type
	Operator string `json:"operator"` // "gt", "lt", "eq", "neq", etc.
}

// SMTPParameters defines configuration for SMTP email nodes.
type SMTPParameters struct {
	Subject string   `json:"subject"`
	Body    string   `json:"body"`
	To      string   `json:"to"`
	From    string   `json:"from"`
	CC      []string `json:"cc"`
	BCC     []string `json:"bcc"`
}

// SMTPCredentials contains SMTP server connection credentials.
type SMTPCredentials struct {
	Port     string `json:"port"`
	Host     string `json:"host"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// Constants for node types
const (
	NodeTypeHTTP          = "http"
	NodeTypeSMTP          = "smtp"
	NodeTypeConditional   = "conditional"
	NodeTypeManualTrigger = "ManualTrigger"
	NodeTypeLog           = "log"
)

// Constants for error handling types
const (
	ErrorHandlingHalt   = "halt"
	ErrorHandlingIgnore = "ignore"
	ErrorHandlingBranch = "branch"
)


// Constants for conditional operators
const (
	OperatorAnd = "and"
	OperatorOr  = "or"
	OperatorGT  = "gt"  // Greater than
	OperatorLT  = "lt"  // Less than
	OperatorEQ  = "eq"  // Equal
	OperatorNEQ = "neq" // Not equal
	OperatorGTE = "gte" // Greater than or equal
	OperatorLTE = "lte" // Less than or equal
)

// GetNodeByID retrieves a node from the workflow by its ID.
// Returns the node and true if found, or an empty node and false if not found.
func (w *Workflow) GetNodeByID(id string) (Node, bool) {
	for _, node := range w.Nodes {
		if node.ID == id {
			return node, true
		}
	}
	return Node{}, false
}

// GetEdgeByID retrieves an edge from the workflow by its ID.
// Returns the edge and true if found, or an empty edge and false if not found.
func (w *Workflow) GetEdgeByID(id string) (Edge, bool) {
	for _, edge := range w.Edges {
		if edge.ID == id {
			return edge, true
		}
	}
	return Edge{}, false
}

// GetTriggerNodes returns all nodes marked as triggers.
// These are typically the starting points for workflow execution.
func (w *Workflow) GetTriggerNodes() []Node {
	var triggers []Node
	for _, node := range w.Nodes {
		if node.Trigger {
			triggers = append(triggers, node)
		}
	}
	return triggers
}

// GetOutgoingEdges returns all edges originating from the specified node.
func (w *Workflow) GetOutgoingEdges(nodeID string) []Edge {
	var edges []Edge
	for _, edge := range w.Edges {
		if edge.Src == nodeID {
			edges = append(edges, edge)
		}
	}
	return edges
}

// GetIncomingEdges returns all edges pointing to the specified node.
func (w *Workflow) GetIncomingEdges(nodeID string) []Edge {
	var edges []Edge
	for _, edge := range w.Edges {
		if edge.Dst == nodeID {
			edges = append(edges, edge)
		}
	}
	return edges
}

// HasCredentials checks if the node has credentials configured.
func (n *Node) HasCredentials() bool {
	return n.Credentials != nil && n.Credentials.ID != ""
}

// HasErrorHandling checks if the node has error handling configured.
func (n *Node) HasErrorHandling() bool {
	return n.Error != nil && n.Error.Type != ""
}