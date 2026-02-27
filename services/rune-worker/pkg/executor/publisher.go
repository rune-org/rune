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

// publishRunningStatus publishes a "running" status message.
func (e *Executor) publishRunningStatus(ctx context.Context, msg *messages.NodeExecutionMessage, node *core.Node, params map[string]any, usedKeys []string, usedInputs map[string]any) error {
	statusMsg := &messages.NodeStatusMessage{
		WorkflowID:       msg.WorkflowID,
		ExecutionID:      msg.ExecutionID,
		NodeID:           node.ID,
		NodeName:         node.Name,
		Status:           messages.StatusRunning,
		Parameters:       params,
		AllUsedInputKeys: usedKeys,
		UsedInputs:       usedInputs,
		ExecutedAt:       time.Now(),
		DurationMs:       0,
	}

	e.enrichStatusWithLineage(statusMsg, msg.LineageStack)

	return e.publishStatus(ctx, statusMsg)
}

// publishNextNodes publishes NodeExecutionMessages for all next nodes.
func (e *Executor) publishNextNodes(ctx context.Context, msg *messages.NodeExecutionMessage, nextNodeIDs []string, updatedContext map[string]interface{}) error {
	for _, nextNodeID := range nextNodeIDs {
		nextMsg := &messages.NodeExecutionMessage{
			WorkflowID:         msg.WorkflowID,
			ExecutionID:        msg.ExecutionID,
			CurrentNode:        nextNodeID,
			WorkflowDefinition: msg.WorkflowDefinition,
			AccumulatedContext: updatedContext,
			LineageStack:       msg.LineageStack, // Propagate stack
			FromNode:           msg.CurrentNode,
			IsWorkerInitiated:  true,
		}

		payload, err := nextMsg.Encode()
		if err != nil {
			slog.Error("failed to encode next node message", "error", err, "next_node", nextNodeID)
			return fmt.Errorf("encode next node message: %w", err)
		}

		if err := e.publisher.Publish(ctx, queue.QueueWorkflowExecution, payload); err != nil {
			slog.Error("failed to publish next node message", "error", err, "next_node", nextNodeID)
			return fmt.Errorf("publish next node message: %w", err)
		}

		slog.Info("published next node message",
			"workflow_id", nextMsg.WorkflowID,
			"execution_id", nextMsg.ExecutionID,
			"next_node", nextNodeID,
			"lineage_depth", len(nextMsg.LineageStack),
		)
	}

	return nil
}

// publishStatus publishes a NodeStatusMessage to the status queue.
func (e *Executor) publishStatus(ctx context.Context, msg *messages.NodeStatusMessage) error {
	payload, err := msg.Encode()
	if err != nil {
		return fmt.Errorf("encode status message: %w", err)
	}

	return e.publisher.Publish(ctx, queue.QueueWorkflowNodeStatus, payload)
}

// publishCompletion publishes a CompletionMessage to the completion queue.
func (e *Executor) publishCompletion(ctx context.Context, msg *messages.NodeExecutionMessage, status string, startTime time.Time, finalContext map[string]interface{}) error {
	totalDuration := time.Since(startTime)

	completionMsg := &messages.CompletionMessage{
		WorkflowID:      msg.WorkflowID,
		ExecutionID:     msg.ExecutionID,
		Status:          status,
		FinalContext:    finalContext,
		CompletedAt:     time.Now(),
		TotalDurationMs: totalDuration.Milliseconds(),
	}

	payload, err := completionMsg.Encode()
	if err != nil {
		return fmt.Errorf("encode completion message: %w", err)
	}

	if err := e.publisher.Publish(ctx, queue.QueueWorkflowCompletion, payload); err != nil {
		return fmt.Errorf("publish completion message: %w", err)
	}

	slog.Info("published completion message",
		"workflow_id", msg.WorkflowID,
		"execution_id", msg.ExecutionID,
		"status", status,
		"duration_ms", totalDuration.Milliseconds(),
	)

	return nil
}
