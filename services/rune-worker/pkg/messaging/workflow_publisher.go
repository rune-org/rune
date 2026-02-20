package messaging

import (
	"context"
	"errors"
	"log/slog"

	"rune-worker/pkg/messages"
	"rune-worker/pkg/platform/queue"
)

// WorkflowPublisher handles publishing workflow-related messages to RabbitMQ.
type WorkflowPublisher struct {
	publisher queue.Publisher
}

// NewWorkflowPublisher creates a new workflow publisher.
func NewWorkflowPublisher(rabbitURL string) (*WorkflowPublisher, error) {
	if rabbitURL == "" {
		return nil, errors.New("workflow publisher: rabbit URL is required")
	}

	pub, err := queue.NewRabbitMQPublisher(rabbitURL)
	if err != nil {
		return nil, err
	}

	return &WorkflowPublisher{
		publisher: pub,
	}, nil
}

// PublishNodeExecution publishes a node execution message to the workflow execution queue.
func (p *WorkflowPublisher) PublishNodeExecution(ctx context.Context, msg *messages.NodeExecutionMessage) error {
	payload, err := msg.Encode()
	if err != nil {
		return err
	}
	if err := p.publisher.Publish(ctx, queue.QueueWorkflowExecution, payload); err != nil {
		return err
	}

	slog.Info("published workflow node execution message",
		"workflow_id", msg.WorkflowID,
		"execution_id", msg.ExecutionID,
		"current_node", msg.CurrentNode,
		"lineage_depth", len(msg.LineageStack),
	)

	return nil
}

// PublishNodeStatus publishes a node status message to the node status queue.
func (p *WorkflowPublisher) PublishNodeStatus(ctx context.Context, msg *messages.NodeStatusMessage) error {
	payload, err := msg.Encode()
	if err != nil {
		return err
	}
	return p.publisher.Publish(ctx, queue.QueueWorkflowNodeStatus, payload)
}

// PublishCompletion publishes a completion message to the workflow completion queue.
func (p *WorkflowPublisher) PublishCompletion(ctx context.Context, msg *messages.CompletionMessage) error {
	payload, err := msg.Encode()
	if err != nil {
		return err
	}
	return p.publisher.Publish(ctx, queue.QueueWorkflowCompletion, payload)
}

// Close releases the underlying publisher resources.
func (p *WorkflowPublisher) Close() error {
	if p.publisher == nil {
		return nil
	}
	return p.publisher.Close()
}
