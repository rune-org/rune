package types

// Constants for node types
const (
	NodeTypeHTTP          = "http"
	NodeTypeSMTP          = "smtp"
	NodeTypeConditional   = "conditional"
	NodeTypeManualTrigger = "ManualTrigger"
	NodeTypeLog           = "log"
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
