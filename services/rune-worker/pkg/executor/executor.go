package executor

import (
	"context"
	"errors"
	"fmt"

	"rune-worker/pkg/dsl"
	"rune-worker/pkg/nodes"
	"rune-worker/pkg/nodes/custom"
	"rune-worker/pkg/messages"
	"rune-worker/plugin"
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
	if e.registry == nil {
		return errors.New("executor registry is nil")
	}
	if msg.WorkflowID == "" {
		return errors.New("workflow ID is required")
	}
	if len(msg.Definition) == 0 {
		return errors.New("workflow definition is empty")
	}

	workflow, err := dsl.ParseWorkflow(msg.Definition)
	if err != nil {
		return fmt.Errorf("parse workflow: %w", err)
	}

	for _, nodeID := range workflow.Start {
		if err := e.executeNode(ctx, workflow, nodeID, msg); err != nil {
			return err
		}
	}

	return nil
}

func (e *Executor) executeNode(ctx context.Context, wf *dsl.Workflow, nodeID string, msg messages.WorkflowStartedMessage) error {
	nodeDef, ok := findNode(wf, nodeID)
	if !ok {
		return fmt.Errorf("node %s not found", nodeID)
	}

	execCtx := plugin.ExecutionContext{
		WorkflowID: msg.WorkflowID,
		NodeID:     nodeDef.ID,
		Parameters: nodeDef.Config,
		Input:      msg.Context,
	}

	node, err := e.registry.Create(nodeDef.Type, execCtx)
	if err != nil {
		return fmt.Errorf("create node %s: %w", nodeDef.Type, err)
	}

	if _, err := node.Execute(ctx, execCtx); err != nil {
		return fmt.Errorf("execute node %s: %w", nodeDef.ID, err)
	}

	return nil
}

func findNode(wf *dsl.Workflow, nodeID string) (dsl.NodeDefinition, bool) {
	for _, node := range wf.Nodes {
		if node.ID == nodeID {
			return node, true
		}
	}
	return dsl.NodeDefinition{}, false
}

// DefaultRegistry returns a registry populated with the built-in nodes.
func DefaultRegistry() *nodes.Registry {
	reg := nodes.NewRegistry()
	custom.RegisterLog(reg)
	return reg
}
