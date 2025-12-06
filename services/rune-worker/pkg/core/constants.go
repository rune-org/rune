package core

// Constants for node types
const (
	NodeTypeHTTP          = "http"
	NodeTypeSMTP          = "smtp"
	NodeTypeConditional   = "conditional"
	NodeTypeManualTrigger = "ManualTrigger"
	NodeTypeEdit          = "edit"
	NodeTypeSwitch        = "switch"
	NodeTypeWait          = "wait"
	NodeTypeSplit         = "split"
	NodeTypeMerge         = "merge"
	NodeTypeAggregator    = "aggregator"
	// Test helper node types
	NodeTypeMock       = "mock"
	NodeTypeConcurrent = "concurrent"
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
