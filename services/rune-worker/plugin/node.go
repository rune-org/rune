package plugin

import "context"

// ExecutionContext exposes runtime information to custom nodes.
type ExecutionContext struct {
	WorkflowID string
	NodeID     string
	Type       string
	Parameters map[string]any
	Input      map[string]any
}

// Node represents a single executable unit within a workflow.
type Node interface {
	Execute(context.Context, ExecutionContext) (map[string]any, error)
}
// $http_node.body.data
// $json.body.data
// $json.body.data.items[0].name
// $json.body.data.items[0].value