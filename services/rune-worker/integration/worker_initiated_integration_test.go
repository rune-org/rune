//go:build integration

package integration

import (
	"context"
	"fmt"
	"testing"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/messaging"
	"rune-worker/pkg/platform/config"
	"rune-worker/pkg/platform/queue"
	testutils "rune-worker/test_utils"
)

// TestWorkerInitiatedMirror verifies that master-initiated execution messages
// are mirrored to workflow.worker.initiated before node execution.
func TestWorkerInitiatedMirror(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	workflowID := fmt.Sprintf("wf-worker-init-%d", time.Now().UnixNano())
	executionID := fmt.Sprintf("exec-worker-init-%d", time.Now().UnixNano())

	workerInitiatedConsumer, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         env.RabbitMQURL,
		QueueName:   "workflow.worker.initiated",
		Prefetch:    10,
		Concurrency: 1,
	})
	if err != nil {
		t.Fatalf("failed to create worker initiated consumer: %v", err)
	}
	defer workerInitiatedConsumer.Close()

	workerCfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		RedisURL:    "redis://" + testutils.DefaultRedisAddr + "/0",
		QueueName:   "workflow.execution",
		Prefetch:    1,
		Concurrency: 1,
	}

	workflowConsumer, err := messaging.NewWorkflowConsumer(workerCfg, env.RedisClient)
	if err != nil {
		t.Fatalf("failed to create workflow consumer: %v", err)
	}
	defer workflowConsumer.Close()

	consumerCtx, consumerCancel := context.WithTimeout(ctx, 8*time.Second)
	defer consumerCancel()
	go func() {
		_ = workflowConsumer.Run(consumerCtx)
	}()

	gotInitiated := make(chan *messages.NodeExecutionMessage, 1)
	wiCtx, wiCancel := context.WithTimeout(ctx, 8*time.Second)
	defer wiCancel()
	go func() {
		_ = workerInitiatedConsumer.Consume(wiCtx, func(ctx context.Context, payload []byte) error {
			msg, err := messages.DecodeNodeExecutionMessage(payload)
			if err != nil {
				return nil
			}
			if msg.WorkflowID == workflowID && msg.ExecutionID == executionID {
				select {
				case gotInitiated <- msg:
				default:
				}
				wiCancel()
			}
			return nil
		})
	}()

	msg := &messages.NodeExecutionMessage{
		WorkflowID:  workflowID,
		ExecutionID: executionID,
		CurrentNode: "node-1",
		WorkflowDefinition: core.Workflow{
			WorkflowID:  workflowID,
			ExecutionID: executionID,
			Nodes: []core.Node{
				{
					ID:         "node-1",
					Name:       "Conditional",
					Type:       "conditional",
					Parameters: map[string]any{"expression": "true"},
				},
			},
		},
		AccumulatedContext: map[string]any{},
		IsWorkerInitiated:  false,
	}

	payload, err := msg.Encode()
	if err != nil {
		t.Fatalf("failed to encode message: %v", err)
	}

	if err := env.Publisher.Publish(ctx, "workflow.execution", payload); err != nil {
		t.Fatalf("failed to publish execution message: %v", err)
	}

	select {
	case mirrored := <-gotInitiated:
		if mirrored.WorkflowID != workflowID || mirrored.ExecutionID != executionID {
			t.Fatalf("unexpected mirrored message identity: %+v", mirrored)
		}
		if mirrored.CurrentNode != "node-1" {
			t.Fatalf("unexpected mirrored current node: %s", mirrored.CurrentNode)
		}
	case <-ctx.Done():
		t.Fatalf("timed out waiting for worker initiated mirror")
	}
}
