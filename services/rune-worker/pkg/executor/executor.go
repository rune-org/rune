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

// Execute triggers the workflow described in the message.
func (e *Executor) Execute(ctx context.Context, msg messages.WorkflowStartedMessage) error {

	return nil
}

func (e *Executor) executeNode(ctx context.Context, wf *dsl.Workflow, nodeID string, msg messages.WorkflowStartedMessage) error {
	return nil
}

func findNode(wf *dsl.Workflow, nodeID string) (dsl.Node, bool) {
	return dsl.Node{}, false
}

// DefaultRegistry returns a registry populated with the built-in nodes.
func DefaultRegistry() *nodes.Registry {
	reg := nodes.NewRegistry()
	custom.RegisterLog(reg)
	return reg
}
