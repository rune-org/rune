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
)

func TestSplitAggregateWorkflow(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	workflowID := fmt.Sprintf("wf_split_agg_%d", time.Now().UnixNano())
	executionID := fmt.Sprintf("exec_split_agg_%d", time.Now().UnixNano())

	// Define workflow: Split -> Aggregator
	workflow := core.Workflow{
		WorkflowID: workflowID,
		Nodes: []core.Node{
			{
				ID:   "split_node",
				Name: "Splitter",
				Type: "split",
				Parameters: map[string]interface{}{
					"input_array": []string{"item1", "item2", "item3"},
				},
			},
			{
				ID:   "aggregator_node",
				Name: "Collector",
				Type: "aggregator",
				Parameters: map[string]interface{}{
					"timeout": 10,
				},
			},
		},
		Edges: []core.Edge{
			{ID: "e1", Src: "split_node", Dst: "aggregator_node"},
		},
	}

	// Create start message
	msg := &messages.NodeExecutionMessage{
		WorkflowID:         workflowID,
		ExecutionID:        executionID,
		CurrentNode:        "split_node",
		WorkflowDefinition: workflow,
		AccumulatedContext: map[string]interface{}{
			"$trigger": map[string]interface{}{"start": true},
		},
	}

	// Wait for consumers to be ready
	time.Sleep(2 * time.Second)

	// Publish start message
	payload, err := msg.Encode()
	if err != nil {
		t.Fatalf("Failed to encode message: %v", err)
	}

	if err := env.Publisher.Publish(ctx, "workflow.execution", payload); err != nil {
		t.Fatalf("Failed to publish message: %v", err)
	}

	// Create a consumer for completion messages
	completionConsumer, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         env.RabbitMQURL,
		QueueName:   "workflow.completion",
		Prefetch:    1,
		Concurrency: 1,
	})
	if err != nil {
		t.Fatalf("Failed to create completion consumer: %v", err)
	}
	defer completionConsumer.Close()

	// Channel to receive the completion message
	completionChan := make(chan messages.CompletionMessage, 1)

	// Start consuming completion messages
	go func() {
		err := completionConsumer.Consume(ctx, func(ctx context.Context, payload []byte) error {
			var completion messages.CompletionMessage
			if err := json.Unmarshal(payload, &completion); err != nil {
				return fmt.Errorf("failed to decode completion message: %w", err)
			}
			if completion.WorkflowID != workflowID {
				// Ignore messages from other tests
				return nil
			}
			completionChan <- completion
			return nil
		})
		if err != nil {
			t.Logf("Completion consumer failed: %v", err)
		}
	}()

	// Start the worker (WorkflowConsumer) to process the workflow
	workerCfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		QueueName:   "workflow.execution",
		Prefetch:    1,
		Concurrency: 1,
	}
	worker, err := messaging.NewWorkflowConsumer(workerCfg, env.RedisClient)
	if err != nil {
		t.Fatalf("Failed to create worker: %v", err)
	}
	defer worker.Close()

	go func() {
		if err := worker.Run(ctx); err != nil {
			t.Logf("Worker stopped: %v", err)
		}
	}()

	// Wait for completion
	select {
	case <-time.After(10 * time.Second):
		t.Fatal("Timed out waiting for workflow completion")
	case completion := <-completionChan:
		if completion.Status != messages.CompletionStatusCompleted {
			t.Fatalf("Expected status completed, got %s", completion.Status)
		}

		// Verify aggregated results
		collectorOutput, ok := completion.FinalContext["$Collector"]
		if !ok {
			t.Fatalf("Final context missing $Collector output. Context: %v", completion.FinalContext)
		}

		outputMap, ok := collectorOutput.(map[string]interface{})
		if !ok {
			t.Fatalf("Collector output is not a map: %T", collectorOutput)
		}

		aggregated, ok := outputMap["aggregated"].([]interface{})
		if !ok {
			t.Fatalf("Collector output missing 'aggregated' field or wrong type: %v", outputMap)
		}

		if len(aggregated) != 3 {
			t.Fatalf("Expected 3 aggregated items, got %d", len(aggregated))
		}

		t.Logf("Successfully verified aggregated results: %v", aggregated)
	}
}
