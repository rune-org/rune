package consumers

import (
	"context"
	"errors"
	"log/slog"

	"rune-worker/pkg/executor"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/platform/config"
	"rune-worker/pkg/platform/queue"
)

// WorkflowConsumer listens to the workflow queue and dispatches messages to the executor.
type WorkflowConsumer struct {
	queue    queue.Consumer
	executor *executor.Executor
}

// NewWorkflowConsumer wires the queue consumer with a default executor.
func NewWorkflowConsumer(cfg *config.WorkerConfig) (*WorkflowConsumer, error) {
	if cfg == nil {
		return nil, errors.New("workflow consumer: config is nil")
	}

	reg := executor.DefaultRegistry()

	q, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         cfg.RabbitURL,
		QueueName:   cfg.QueueName,
		Prefetch:    cfg.Prefetch,
		Concurrency: cfg.Concurrency,
	})
	if err != nil {
		return nil, err
	}

	return &WorkflowConsumer{
		queue:    q,
		executor: executor.NewExecutor(reg),
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

// Close releases underlying queue resources.
func (c *WorkflowConsumer) Close() error {
	if c.queue == nil {
		return nil
	}
	return c.queue.Close()
}

func (c *WorkflowConsumer) handleMessage(ctx context.Context, payload []byte) error {
	msg, err := messages.DecodeNodeExecutionMessage(payload)
	if err != nil {
		slog.Error("invalid node execution message", "error", err)
		return err
	}

	if err := c.executor.Execute(ctx, msg); err != nil {
		slog.Error("failed to execute node",
			"workflow_id", msg.WorkflowID,
			"execution_id", msg.ExecutionID,
			"node_id", msg.CurrentNode,
			"error", err)
		return err
	}

	slog.Info("node processed",
		"workflow_id", msg.WorkflowID,
		"execution_id", msg.ExecutionID,
		"node_id", msg.CurrentNode)
	return nil
}
