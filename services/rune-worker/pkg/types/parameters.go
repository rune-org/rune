package types

// TODO: All parameter structs must be moved to the specific node type files in the future.

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
