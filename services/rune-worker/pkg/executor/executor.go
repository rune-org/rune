package executor

import (
	"context"
	"rune-worker/pkg/dsl"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/nodes"
	"rune-worker/pkg/nodes/custom"
)

// Executor evaluates workflow definitions and invokes nodes in order.
type Executor struct {
	registry *nodes.Registry
}

// NewExecutor builds an executor with the provided registry.
func NewExecutor(reg *nodes.Registry) *Executor {
	if reg == nil {
		reg = DefaultRegistry()
	}

	return &Executor{registry: reg}
}

// Execute processes a single node execution message.
// This method handles both initial workflow starts (from master) and recursive
// node executions (from other workers).
func (e *Executor) Execute(ctx context.Context, msg *messages.NodeExecutionMessage) error {
	// TODO: Implement execution logic per RFC-001
	// 1. Validate message
	// 2. Lookup current node from workflow definition
	// 3. Publish "running" status
	// 4. Build ExecutionContext from accumulated_context
	// 5. Execute node with context
	// 6. Publish "success" or "failed" status
	// 7. Determine next nodes via graph traversal
	// 8. Publish NodeExecutionMessage for each next node OR CompletionMessage
	return nil
}

func (e *Executor) executeNode(ctx context.Context, wf *dsl.Workflow, nodeID string, msg *messages.NodeExecutionMessage) error {
	return nil
}

// DefaultRegistry returns a registry populated with the built-in nodes.
func DefaultRegistry() *nodes.Registry {
	reg := nodes.NewRegistry()
	custom.RegisterLog(reg)
	return reg
}
