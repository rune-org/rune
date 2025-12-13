//go:build integration

package integration

import (
	"context"
	"encoding/json"
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

// Verifies edit node transforms payload and updates $json in final context.
func TestEditNodeIntegration(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	workflowID := fmt.Sprintf("wf_edit_%d", time.Now().UnixNano())
	executionID := fmt.Sprintf("exec_edit_%d", time.Now().UnixNano())

	workflow := core.Workflow{
		WorkflowID: workflowID,
		Nodes: []core.Node{
			{
				ID:   "edit_node",
				Name: "Transform",
				Type: "edit",
				Parameters: map[string]any{
					"assignments": []any{
						map[string]any{"name": "full_name", "value": "{{ $json.first + ' ' + $json.last }}", "type": "string"},
						map[string]any{"name": "active", "value": "true", "type": "boolean"},
					},
				},
			},
		},
	}

	msg := &messages.NodeExecutionMessage{
		WorkflowID:         workflowID,
		ExecutionID:        executionID,
		CurrentNode:        "edit_node",
		WorkflowDefinition: workflow,
		AccumulatedContext: map[string]any{"$json": map[string]any{"first": "Alice", "last": "Smith"}},
	}

	payload, err := msg.Encode()
	if err != nil {
		t.Fatalf("encode message: %v", err)
	}

	if err := env.Publisher.Publish(ctx, "workflow.execution", payload); err != nil {
		t.Fatalf("publish message: %v", err)
	}

	completionConsumer, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         env.RabbitMQURL,
		QueueName:   "workflow.completion",
		Prefetch:    1,
		Concurrency: 1,
	})
	if err != nil {
		t.Fatalf("create completion consumer: %v", err)
	}
	defer completionConsumer.Close()

	completionChan := make(chan messages.CompletionMessage, 1)
	go func() {
		_ = completionConsumer.Consume(ctx, func(ctx context.Context, payload []byte) error {
			var completion messages.CompletionMessage
			if err := json.Unmarshal(payload, &completion); err != nil {
				return err
			}
			if completion.WorkflowID == workflowID {
				completionChan <- completion
			}
			return nil
		})
	}()

	workerCfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		RedisURL:    "redis://" + testutils.DefaultRedisAddr + "/0",
		QueueName:   "workflow.execution",
		Prefetch:    1,
		Concurrency: 1,
	}
	worker, err := messaging.NewWorkflowConsumer(workerCfg, env.RedisClient)
	if err != nil {
		t.Fatalf("create worker: %v", err)
	}
	defer worker.Close()

	go func() {
		_ = worker.Run(ctx)
	}()

	select {
	case completion := <-completionChan:
		if completion.Status != messages.CompletionStatusCompleted {
			t.Fatalf("expected completed status, got %s", completion.Status)
		}
		jsonCtx, ok := completion.FinalContext["$json"].(map[string]any)
		if !ok {
			t.Fatalf("$json missing in final context")
		}
		if jsonCtx["full_name"] != "Alice Smith" {
			t.Fatalf("full_name mismatch: %+v", jsonCtx)
		}
		if jsonCtx["active"] != true {
			t.Fatalf("active mismatch: %+v", jsonCtx)
		}
	case <-time.After(30 * time.Second):
		t.Fatalf("timed out waiting for completion")
	}
}
