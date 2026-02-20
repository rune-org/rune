package executor

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"rune-worker/pkg/messages"
	"rune-worker/pkg/nodes"
	"rune-worker/pkg/platform/queue"
	"rune-worker/pkg/registry"
)

// Executor evaluates workflow definitions and invokes nodes in order.
// It implements the recursive node-by-node execution model as specified in RFC-001.
type Executor struct {
	registry    *nodes.Registry
	publisher   queue.Publisher
	redisClient interface{}
}

// NewExecutor builds an executor with the provided registry and publisher.
func NewExecutor(reg *nodes.Registry, pub queue.Publisher, redisClient interface{}) *Executor {
	if reg == nil {
		reg = registry.InitializeRegistry()
	}

	return &Executor{
		registry:    reg,
		publisher:   pub,
		redisClient: redisClient,
	}
}

// Execute processes a single node execution message.
// This method handles both initial workflow starts (from master) and recursive
// node executions (from other workers).
//
// Execution sequence per RFC-001 Section 7.2:
//  1. Parse workflow definition
//  2. Lookup node by current_node ID
//  3. Validate node exists and is executable
//  4. Publish NodeStatusMessage(status=running)
//  5. Build ExecutionContext from accumulated_context
//  6. Execute node logic with ExecutionContext
//  7. If successful:
//     a. Publish NodeStatusMessage(status=success)
//     b. Accumulate result into context
//     c. Determine next nodes via graph traversal
//     d. Publish NodeExecutionMessage for each next node OR CompletionMessage
//  8. If failed:
//     a. Publish NodeStatusMessage(status=failed)
//     b. Apply error handling strategy (halt|ignore|branch)
//     c. Publish appropriate next message or completion
func (e *Executor) Execute(ctx context.Context, msg *messages.NodeExecutionMessage) error {
	startTime := time.Now()

	// Step 1 & 2: Get workflow and current node
	node, err := msg.GetCurrentNodeDetails()
	if err != nil {
		slog.Error("failed to get current node", "error", err, "node_id", msg.CurrentNode)
		return fmt.Errorf("get current node: %w", err)
	}

	slog.Info("executing node",
		"workflow_id", msg.WorkflowID,
		"execution_id", msg.ExecutionID,
		"node_id", node.ID,
		"node_name", node.Name,
		"node_type", node.Type,
	)

	// Step 4: Build context
	execContext, usedKeys := e.buildExecutionContext(msg, &node)
	usedInputs := e.filterUsedInputs(execContext.Input, usedKeys)

	// Step 5: Publish "running" status
	if err := e.publishRunningStatus(ctx, msg, &node, execContext.Parameters, usedKeys, usedInputs); err != nil {
		slog.Error("failed to publish running status", "error", err)
		// Continue execution even if status publish fails
	}

	nodeInstance, err := e.registry.Create(node.Type, execContext)
	if err != nil {
		return e.handleNodeCreationFailure(ctx, msg, &node, err, startTime, execContext.Parameters, usedKeys, usedInputs)
	}

	output, execErr := nodeInstance.Execute(ctx, execContext)
	duration := time.Since(startTime)

	if execErr != nil {
		return e.handleNodeFailure(ctx, msg, &node, execErr, duration, execContext.Parameters, usedKeys, usedInputs)
	}

	if node.Type == "wait" {
		return e.handleWaitNode(ctx, msg, &node, output, duration, execContext.Parameters, usedKeys, usedInputs)
	}

	// Step 7 & 8: Handle execution result
	return e.handleNodeSuccess(ctx, msg, &node, output, duration, startTime, execContext.Parameters, usedKeys, usedInputs)
}
