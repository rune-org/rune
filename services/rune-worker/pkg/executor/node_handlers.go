package executor

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/platform/queue"
)

// handleWaitNode publishes a waiting status and stops further execution for this branch.
func (e *Executor) handleWaitNode(ctx context.Context, msg *messages.NodeExecutionMessage, node *core.Node, output map[string]any, duration time.Duration, params map[string]any, usedKeys []string, usedInputs map[string]any) error {
	statusMsg := &messages.NodeStatusMessage{
		WorkflowID:       msg.WorkflowID,
		ExecutionID:      msg.ExecutionID,
		NodeID:           node.ID,
		NodeName:         node.Name,
		Status:           messages.StatusWaiting,
		Parameters:       params,
		Output:           output,
		ExecutedAt:       time.Now(),
		DurationMs:       duration.Milliseconds(),
		AllUsedInputKeys: usedKeys,
		UsedInputs:       usedInputs,
	}

	e.enrichStatusWithLineage(statusMsg, msg.LineageStack)

	if err := e.publishStatus(ctx, statusMsg); err != nil {
		slog.Error("failed to publish waiting status", "error", err)
	}

	slog.Info("wait node scheduled and branch suspended",
		"workflow_id", msg.WorkflowID,
		"execution_id", msg.ExecutionID,
		"node_id", node.ID,
		"resume_at", output["resume_at"],
		"timer_id", output["timer_id"],
	)

	return nil
}

// handleNodeCreationFailure handles the case when a node cannot be created from the registry.
func (e *Executor) handleNodeCreationFailure(ctx context.Context, msg *messages.NodeExecutionMessage, node *core.Node, err error, startTime time.Time, params map[string]any, usedKeys []string, usedInputs map[string]any) error {
	duration := time.Since(startTime)
	slog.Error("failed to create node", "error", err, "node_type", node.Type)

	statusMsg := &messages.NodeStatusMessage{
		WorkflowID:  msg.WorkflowID,
		ExecutionID: msg.ExecutionID,
		NodeID:      node.ID,
		NodeName:    node.Name,
		Status:      messages.StatusFailed,
		Parameters:  params,
		Error: &messages.NodeError{
			Message: fmt.Sprintf("failed to create node of type %s", node.Type),
			Code:    "NODE_CREATION_FAILED",
			Details: map[string]interface{}{"error": err.Error()},
		},
		AllUsedInputKeys: usedKeys,
		UsedInputs:       usedInputs,
		ExecutedAt:       time.Now(),
		DurationMs:       duration.Milliseconds(),
	}

	e.enrichStatusWithLineage(statusMsg, msg.LineageStack)

	_ = e.publishStatus(ctx, statusMsg)

	// Node creation failure is always a halt condition
	return e.publishCompletion(ctx, msg, messages.CompletionStatusFailed, startTime, msg.AccumulatedContext)
}

// handleNodeFailure processes a node execution failure according to error handling strategy.
func (e *Executor) handleNodeFailure(ctx context.Context, msg *messages.NodeExecutionMessage, node *core.Node, execErr error, duration time.Duration, params map[string]any, usedKeys []string, usedInputs map[string]any) error {
	slog.Error("node execution failed",
		"error", execErr,
		"node_id", node.ID,
		"node_name", node.Name,
	)

	// Publish failed status
	statusMsg := &messages.NodeStatusMessage{
		WorkflowID:  msg.WorkflowID,
		ExecutionID: msg.ExecutionID,
		NodeID:      node.ID,
		NodeName:    node.Name,
		Status:      messages.StatusFailed,
		Parameters:  params,
		Error: &messages.NodeError{
			Message: execErr.Error(),
			Code:    "NODE_EXECUTION_FAILED",
		},
		AllUsedInputKeys: usedKeys,
		UsedInputs:       usedInputs,
		ExecutedAt:       time.Now(),
		DurationMs:       duration.Milliseconds(),
	}

	if err := e.publishStatus(ctx, statusMsg); err != nil {
		slog.Error("failed to publish failed status", "error", err)
	}

	// Apply error handling strategy
	errorStrategy := "halt" // default
	if node.Error != nil && node.Error.Type != "" {
		errorStrategy = node.Error.Type
	}

	switch errorStrategy {
	case "halt":
		return e.publishCompletion(ctx, msg, messages.CompletionStatusHalted, time.Now(), msg.AccumulatedContext)

	case "ignore":
		// Continue to next nodes despite error
		nextNodes := e.determineNextNodes(&msg.WorkflowDefinition, node, nil)
		return e.publishNextNodes(ctx, msg, nextNodes, msg.AccumulatedContext)

	case "branch":
		// Follow error edge if specified
		if node.Error != nil && node.Error.ErrorEdge != "" {
			errorNode := e.getNodeByErrorEdge(&msg.WorkflowDefinition, node.Error.ErrorEdge)
			if errorNode != nil {
				return e.publishNextNodes(ctx, msg, []string{errorNode.ID}, msg.AccumulatedContext)
			}
		}
		// If no error edge, halt
		return e.publishCompletion(ctx, msg, messages.CompletionStatusHalted, time.Now(), msg.AccumulatedContext)

	default:
		slog.Warn("unknown error strategy, halting", "strategy", errorStrategy)
		return e.publishCompletion(ctx, msg, messages.CompletionStatusHalted, time.Now(), msg.AccumulatedContext)
	}
}

// handleNodeSuccess processes a successful node execution.
func (e *Executor) handleNodeSuccess(ctx context.Context, msg *messages.NodeExecutionMessage, node *core.Node, output map[string]any, duration time.Duration, startTime time.Time, params map[string]any, usedKeys []string, usedInputs map[string]any) error {
	slog.Info("node execution succeeded",
		"node_id", node.ID,
		"node_name", node.Name,
		"duration_ms", duration.Milliseconds(),
	)

	// Publish success status
	statusMsg := &messages.NodeStatusMessage{
		WorkflowID:       msg.WorkflowID,
		ExecutionID:      msg.ExecutionID,
		NodeID:           node.ID,
		NodeName:         node.Name,
		Status:           messages.StatusSuccess,
		Parameters:       params,
		Output:           output,
		ExecutedAt:       time.Now(),
		DurationMs:       duration.Milliseconds(),
		AllUsedInputKeys: usedKeys,
		UsedInputs:       usedInputs,
	}

	e.enrichStatusWithLineage(statusMsg, msg.LineageStack)
	e.applyAggregatorMetadata(statusMsg, node, output)

	if err := e.publishStatus(ctx, statusMsg); err != nil {
		slog.Error("failed to publish success status", "error", err)
	}

	// Accumulate result into context with $<node_name> key
	updatedContext := e.accumulateContext(msg.AccumulatedContext, node.Name, output)

	// Edit node transforms the working payload; propagate to $json for downstream expressions.
	if node.Type == "edit" {
		if json, ok := output["$json"]; ok {
			updatedContext["$json"] = json
		}
	}

	// Handle Aggregator Barrier early to avoid publishing status for closed barrier branches.
	if node.Type == "aggregator" {
		if _, closed := output["_barrier_closed"]; closed {
			slog.Info("aggregator barrier closed, halting branch", "node_id", node.ID)
			return nil // Do not publish status, next nodes, or completion
		}
	}

	// Merge node returns a unified merged_context for downstream nodes
	if node.Type == "merge" {
		if merged, ok := output["merged_context"].(map[string]any); ok {
			updatedContext = merged
		}
	}

	// Determine next nodes via graph traversal
	nextNodes := e.determineNextNodes(&msg.WorkflowDefinition, node, output)

	// Handle Split Node Fan-Out
	if node.Type == "split" {
		if items, ok := output["_split_items"].([]any); ok {
			return e.handleSplitFanOut(ctx, msg, node, nextNodes, items, updatedContext)
		}
	}

	// Handle Merge waiting/ignored branches
	if node.Type == "merge" {
		if waiting, ok := output["_merge_waiting"].(bool); ok && waiting {
			slog.Info("merge waiting, parking branch", "node_id", node.ID)
			return nil
		}
		if ignored, ok := output["_merge_ignored"].(bool); ok && ignored {
			slog.Info("merge branch ignored due to wait_for_any", "node_id", node.ID)
			return nil
		}
	}

	if len(nextNodes) == 0 {
		// No more nodes to execute - workflow completed
		slog.Info("workflow completed", "workflow_id", msg.WorkflowID, "execution_id", msg.ExecutionID, "final_context_keys", getKeys(updatedContext))
		return e.publishCompletion(ctx, msg, messages.CompletionStatusCompleted, startTime, updatedContext)
	}

	// Publish execution messages for next nodes
	return e.publishNextNodes(ctx, msg, nextNodes, updatedContext)
}

// handleSplitFanOut iterates over items and publishes messages for each.
func (e *Executor) handleSplitFanOut(ctx context.Context, msg *messages.NodeExecutionMessage, node *core.Node, nextNodes []string, items []any, baseContext map[string]interface{}) error {
	slog.Info("handling split fan-out", "node_id", node.ID, "item_count", len(items))

	for i, item := range items {
		// Create new context for this item
		itemContext := make(map[string]interface{}, len(baseContext)+1)
		for k, v := range baseContext {
			itemContext[k] = v
		}

		itemContext["$item"] = item

		// Clone and update lineage stack
		newStack := make([]messages.StackFrame, len(msg.LineageStack)+1)
		copy(newStack, msg.LineageStack)

		newStack[len(msg.LineageStack)] = messages.StackFrame{
			SplitNodeID: node.ID,
			BranchID:    fmt.Sprintf("%s_%s_%d", msg.ExecutionID, node.ID, i),
			ItemIndex:   i,
			TotalItems:  len(items),
		}

		// Publish to next nodes
		for _, nextNodeID := range nextNodes {
			nextMsg := &messages.NodeExecutionMessage{
				WorkflowID:         msg.WorkflowID,
				ExecutionID:        msg.ExecutionID,
				CurrentNode:        nextNodeID,
				WorkflowDefinition: msg.WorkflowDefinition,
				AccumulatedContext: itemContext,
				LineageStack:       newStack,
				FromNode:           node.ID,
				IsWorkerInitiated:  true,
			}

			payload, err := nextMsg.Encode()
			if err != nil {
				return fmt.Errorf("encode split message: %w", err)
			}

			if err := e.publisher.Publish(ctx, queue.QueueWorkflowExecution, payload); err != nil {
				return fmt.Errorf("publish split message: %w", err)
			}

			slog.Info("published split node message",
				"workflow_id", nextMsg.WorkflowID,
				"execution_id", nextMsg.ExecutionID,
				"target_node", nextNodeID,
				"lineage_depth", len(nextMsg.LineageStack),
			)
		}
	}

	return nil
}
