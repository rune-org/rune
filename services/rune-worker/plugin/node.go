package plugin

import "context"

// ExecutionContext exposes runtime information to custom nodes.
type ExecutionContext struct {
	WorkflowID string
	NodeID     string
	Config     map[string]any
	Input      map[string]any
}

// Node represents a single executable unit within a workflow.
type Node interface {
	Execute(context.Context, ExecutionContext) (map[string]any, error)
}
