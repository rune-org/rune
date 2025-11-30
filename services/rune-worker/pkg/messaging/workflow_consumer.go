package messaging

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"rune-worker/pkg/executor"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/platform/config"
	"rune-worker/pkg/platform/queue"
	"rune-worker/pkg/registry"

	"github.com/redis/go-redis/v9"
)

// WorkflowConsumer orchestrates workflow execution by consuming messages,
// invoking the executor, and handling acknowledgments for fault tolerance.
type WorkflowConsumer struct {
	queue    queue.Consumer
	executor *executor.Executor
}

// NewWorkflowConsumer wires the queue consumer with a default executor.
func NewWorkflowConsumer(cfg *config.WorkerConfig, redisClient *redis.Client) (*WorkflowConsumer, error) {
	if cfg == nil {
		return nil, errors.New("workflow consumer: config is nil")
	}

	reg := registry.InitializeRegistry()

	q, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         cfg.RabbitURL,
		QueueName:   cfg.QueueName,
		Prefetch:    cfg.Prefetch,
		Concurrency: cfg.Concurrency,
	})
	if err != nil {
		return nil, err
	}

	// Create publisher for executor (uses the underlying queue publisher)
	pub, err := queue.NewRabbitMQPublisher(cfg.RabbitURL)
	if err != nil {
		_ = q.Close()
		return nil, err
	}

	return &WorkflowConsumer{
		queue:    q,
		executor: executor.NewExecutor(reg, pub, redisClient),
	}, nil
}

// Run starts consuming messages until the queue consumer stops.
func (c *WorkflowConsumer) Run(ctx context.Context) error {
	if ctx == nil {
		ctx = context.Background()
	}

	slog.Info("workflow consumer starting")
	return c.queue.Consume(ctx, c.handleMessage)
}

// Close releases underlying queue and publisher resources.
func (c *WorkflowConsumer) Close() error {
	var queueErr, pubErr error

	if c.queue != nil {
		queueErr = c.queue.Close()
	}

	if queueErr != nil {
		return queueErr
	}
	return pubErr
}

// handleMessage decodes incoming messages, executes nodes, and returns errors
// to trigger requeue or nil to trigger acknowledgment.
func (c *WorkflowConsumer) handleMessage(ctx context.Context, payload []byte) error {
	msg, err := messages.DecodeNodeExecutionMessage(payload)
	if err != nil {
		slog.Error("failed to decode node execution message",
			"error", err,
			"payload_size", len(payload))
		return fmt.Errorf("decode message: %w", err)
	}

	slog.Info("received node execution message",
		"workflow_id", msg.WorkflowID,
		"execution_id", msg.ExecutionID,
		"node_id", msg.CurrentNode)

	if err := c.executor.Execute(ctx, msg); err != nil {
		slog.Error("executor failed to process node",
			"workflow_id", msg.WorkflowID,
			"execution_id", msg.ExecutionID,
			"node_id", msg.CurrentNode,
			"error", err)
		return fmt.Errorf("execute node: %w", err)
	}

	slog.Info("successfully orchestrated node execution",
		"workflow_id", msg.WorkflowID,
		"execution_id", msg.ExecutionID,
		"node_id", msg.CurrentNode)

	return nil
}
