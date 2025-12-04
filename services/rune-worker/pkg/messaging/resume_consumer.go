package messaging

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"rune-worker/pkg/core"
	"rune-worker/pkg/dsl"
	"rune-worker/pkg/executor"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/platform/config"
	"rune-worker/pkg/platform/queue"
	"rune-worker/pkg/registry"

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

	reg := registry.InitializeRegistry()

	q, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         cfg.RabbitURL,
		QueueName:   "workflow.resume",
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
	if c.queue != nil {
		return c.queue.Close()
	}
	return nil
}

// handleResume processes a resumed wait node by determining next nodes and continuing execution.
func (c *ResumeConsumer) handleResume(ctx context.Context, payload []byte) error {
	msg, err := messages.DecodeNodeExecutionMessage(payload)
	if err != nil {
		slog.Error("failed to decode resume message",
			"error", err,
			"payload_size", len(payload))
		return fmt.Errorf("decode resume message: %w", err)
	}

	slog.Info("processing resumed wait node",
		"workflow_id", msg.WorkflowID,
		"execution_id", msg.ExecutionID,
		"node_id", msg.CurrentNode)

	// Get the wait node details
	node, found := msg.WorkflowDefinition.GetNodeByID(msg.CurrentNode)
	if !found {
		return fmt.Errorf("wait node %s not found in workflow", msg.CurrentNode)
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
			ExecutionID:        msg.ExecutionID,
			CurrentNode:        nextNodeID,
			WorkflowDefinition: msg.WorkflowDefinition,
			AccumulatedContext: msg.AccumulatedContext,
			LineageStack:       msg.LineageStack,
		}

		msgBytes, err := nextMsg.Encode()
		if err != nil {
			slog.Error("failed to encode next node message",
				"error", err,
				"next_node", nextNodeID)
			return err
		}

		if err := c.publisher.Publish(ctx, "workflow.execution", msgBytes); err != nil {
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
		return fmt.Errorf("encode completion message: %w", err)
	}

	return c.publisher.Publish(ctx, "workflow.completion", payload)
}
