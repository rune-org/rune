package messaging

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/dsl"
	"rune-worker/pkg/executor"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/platform/config"
	"rune-worker/pkg/platform/queue"
	"rune-worker/pkg/registry"
	"rune-worker/pkg/resolver"

	"github.com/redis/go-redis/v9"
)

// ResumeConsumer handles resumed workflow executions after wait timers fire.
type ResumeConsumer struct {
	queue     queue.Consumer
	executor  *executor.Executor
	publisher queue.Publisher
}

// NewResumeConsumer creates a consumer for the workflow.resume queue.
func NewResumeConsumer(cfg *config.WorkerConfig, redisClient *redis.Client) (*ResumeConsumer, error) {
	if cfg == nil {
		return nil, errors.New("resume consumer: config is nil")
	}

	reg, _ := registry.InitializeRegistry()

	q, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         cfg.RabbitURL,
		QueueName:   queue.QueueWorkflowResume,
		Prefetch:    cfg.Prefetch,
		Concurrency: cfg.Concurrency,
	})
	if err != nil {
		return nil, err
	}

	pub, err := queue.NewRabbitMQPublisher(cfg.RabbitURL)
	if err != nil {
		_ = q.Close()
		return nil, err
	}

	return &ResumeConsumer{
		queue:     q,
		executor:  executor.NewExecutor(reg, pub, redisClient),
		publisher: pub,
	}, nil
}

// Run starts consuming resume messages until context is cancelled.
func (c *ResumeConsumer) Run(ctx context.Context) error {
	if ctx == nil {
		ctx = context.Background()
	}

	slog.Info("resume consumer starting")
	return c.queue.Consume(ctx, c.handleResume)
}

// Close releases underlying resources.
func (c *ResumeConsumer) Close() error {
	var errs []error

	if c.queue != nil {
		if err := c.queue.Close(); err != nil {
			errs = append(errs, fmt.Errorf("close queue: %w", err))
		}
	}

	if c.publisher != nil {
		if err := c.publisher.Close(); err != nil {
			errs = append(errs, fmt.Errorf("close publisher: %w", err))
		}
	}

	return errors.Join(errs...)
}

// handleResume processes a resumed wait node by determining next nodes and continuing execution.
func (c *ResumeConsumer) handleResume(ctx context.Context, payload []byte) error {
	msg, err := messages.DecodeNodeExecutionMessage(payload)
	if err != nil {
		slog.Error("failed to decode resume message",
			"error", err,
			"payload_size", len(payload))
		return queue.NonRetryable(fmt.Errorf("decode resume message: %w", err))
	}

	slog.Info("processing resumed wait node",
		"workflow_id", msg.WorkflowID,
		"execution_id", msg.ExecutionID,
		"node_id", msg.CurrentNode)

	// Get the wait node details
	node, found := msg.WorkflowDefinition.GetNodeByID(msg.CurrentNode)
	if !found {
		return queue.NonRetryable(fmt.Errorf("wait node %s not found in workflow", msg.CurrentNode))
	}

	// Publish success status for wait node
	if err := c.publishWaitSuccessStatus(ctx, msg, &node); err != nil {
		slog.Error("failed to publish wait success status",
			"error", err,
			"workflow_id", msg.WorkflowID,
			"execution_id", msg.ExecutionID,
			"node_id", node.ID)
	}

	// Determine next nodes after the wait node
	nextNodes := c.determineNextNodes(&msg.WorkflowDefinition, &node)

	if len(nextNodes) == 0 {
		// No more nodes - workflow completed
		slog.Info("workflow completed after wait",
			"workflow_id", msg.WorkflowID,
			"execution_id", msg.ExecutionID)
		return c.publishCompletion(ctx, msg)
	}

	// Publish execution messages for next nodes
	for _, nextNodeID := range nextNodes {
		nextMsg := &messages.NodeExecutionMessage{
			WorkflowID:         msg.WorkflowID,
			WorkflowVersion:    msg.WorkflowVersion,
			WorkflowVersionID:  msg.WorkflowVersionID,
			ExecutionID:        msg.ExecutionID,
			CurrentNode:        nextNodeID,
			WorkflowDefinition: msg.WorkflowDefinition,
			AccumulatedContext: msg.AccumulatedContext,
			LineageStack:       msg.LineageStack,
			IsWorkerInitiated:  true,
		}

		msgBytes, err := nextMsg.Encode()
		if err != nil {
			slog.Error("failed to encode next node message",
				"error", err,
				"next_node", nextNodeID)
			return queue.NonRetryable(fmt.Errorf("encode next node message: %w", err))
		}

		if err := c.publisher.Publish(ctx, queue.QueueWorkflowExecution, msgBytes); err != nil {
			slog.Error("failed to publish next node message",
				"error", err,
				"next_node", nextNodeID)
			return err
		}

		slog.Info("published next node after wait resume",
			"workflow_id", msg.WorkflowID,
			"execution_id", msg.ExecutionID,
			"next_node", nextNodeID)
	}

	return nil
}

// publishWaitSuccessStatus emits a success NodeStatusMessage for the resumed
// wait node. The output (resume_at, timer_id) and resolved parameters are
// carried forward from the suspend-time snapshot so that persisted execution
// history retains the original runtime data after the status transitions.
func (c *ResumeConsumer) publishWaitSuccessStatus(ctx context.Context, msg *messages.NodeExecutionMessage, node *core.Node) error {
	output := extractWaitOutput(msg.AccumulatedContext, node.Name)
	params := resolveWaitParameters(node, msg.AccumulatedContext)

	statusMsg := &messages.NodeStatusMessage{
		WorkflowID:  msg.WorkflowID,
		ExecutionID: msg.ExecutionID,
		NodeID:      node.ID,
		NodeName:    node.Name,
		Status:      messages.StatusSuccess,
		Parameters:  params,
		Output:      output,
		ExecutedAt:  time.Now(),
		DurationMs:  0,
	}

	if len(msg.LineageStack) > 0 {
		statusMsg.LineageStack = append(statusMsg.LineageStack, msg.LineageStack...)
		top := msg.LineageStack[len(msg.LineageStack)-1]
		statusMsg.BranchID = top.BranchID
		statusMsg.SplitNodeID = top.SplitNodeID
		itemIndex := top.ItemIndex
		totalItems := top.TotalItems
		statusMsg.ItemIndex = &itemIndex
		statusMsg.TotalItems = &totalItems
	}

	payload, err := statusMsg.Encode()
	if err != nil {
		return fmt.Errorf("encode wait success status: %w", err)
	}

	return c.publisher.Publish(ctx, queue.QueueWorkflowNodeStatus, payload)
}

// extractWaitOutput returns the wait node's original output
// ({resume_at, timer_id}) which the wait node stashed in the accumulated
// context under $<node_name> before suspending.
func extractWaitOutput(accumulated map[string]any, nodeName string) map[string]any {
	if accumulated == nil || nodeName == "" {
		return nil
	}
	raw, ok := accumulated["$"+nodeName]
	if !ok {
		return nil
	}
	output, ok := raw.(map[string]any)
	if !ok {
		return nil
	}
	return output
}

// resolveWaitParameters resolves the wait node's parameter references against
// the accumulated context, matching what was emitted on the waiting status.
func resolveWaitParameters(node *core.Node, accumulated map[string]any) map[string]any {
	if len(node.Parameters) == 0 || accumulated == nil {
		return node.Parameters
	}
	resolved, err := resolver.NewResolver(accumulated).ResolveParameters(node.Parameters)
	if err != nil {
		return node.Parameters
	}
	return resolved
}

// determineNextNodes finds nodes connected after the wait node.
func (c *ResumeConsumer) determineNextNodes(wf *core.Workflow, node *core.Node) []string {
	graph := dsl.BuildGraph(wf)
	return graph.GetNeighbors(node.ID)
}

// publishCompletion publishes a workflow completion message.
func (c *ResumeConsumer) publishCompletion(ctx context.Context, msg *messages.NodeExecutionMessage) error {
	completionMsg := messages.NewCompletedMessage(
		msg.WorkflowID,
		msg.ExecutionID,
		msg.AccumulatedContext,
		0, // Duration not tracked for resumed workflows
	)

	payload, err := completionMsg.Encode()
	if err != nil {
		return queue.NonRetryable(fmt.Errorf("encode completion message: %w", err))
	}

	return c.publisher.Publish(ctx, queue.QueueWorkflowCompletion, payload)
}
