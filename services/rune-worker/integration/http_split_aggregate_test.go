//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/messaging"
	"rune-worker/pkg/platform/config"
	"rune-worker/pkg/platform/queue"
	testutils "rune-worker/test_utils"
)

func TestHTTPSplitAggregateWorkflow(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	users := []map[string]any{
		{"id": 1, "name": "Alice"},
		{"id": 2, "name": "Bob"},
		{"id": 3, "name": "Carol"},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/users":
			_ = json.NewEncoder(w).Encode(users)
		case strings.HasPrefix(r.URL.Path, "/users/"):
			idStr := strings.TrimPrefix(r.URL.Path, "/users/")
			id, _ := strconv.Atoi(idStr)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":     id,
				"detail": fmt.Sprintf("detail-%d", id),
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	workflowID := fmt.Sprintf("wf_http_split_%d", time.Now().UnixNano())
	executionID := fmt.Sprintf("exec_http_split_%d", time.Now().UnixNano())

	// Define workflow: Fetch Users -> Split -> Fetch Details -> Aggregate
	workflow := core.Workflow{
		WorkflowID: workflowID,
		Nodes: []core.Node{
			{
				ID:   "fetch_users",
				Name: "Fetch Users",
				Type: "http",
				Parameters: map[string]interface{}{
					"url":    server.URL + "/users",
					"method": "GET",
				},
			},
			{
				ID:   "split_users",
				Name: "Split Users",
				Type: "split",
				Parameters: map[string]interface{}{
					"input_array": "$Fetch Users.body",
				},
			},
			{
				ID:   "fetch_details",
				Name: "Fetch Details",
				Type: "http",
				Parameters: map[string]interface{}{
					"url":    server.URL + "/users/$item.id",
					"method": "GET",
				},
			},
			{
				ID:   "aggregate_users",
				Name: "Aggregate Users",
				Type: "aggregator",
				Parameters: map[string]interface{}{
					"timeout": 30,
				},
			},
		},
		Edges: []core.Edge{
			{ID: "e1", Src: "fetch_users", Dst: "split_users"},
			{ID: "e2", Src: "split_users", Dst: "fetch_details"},
			{ID: "e3", Src: "fetch_details", Dst: "aggregate_users"},
		},
	}

	// Create start message
	msg := &messages.NodeExecutionMessage{
		WorkflowID:         workflowID,
		ExecutionID:        executionID,
		CurrentNode:        "fetch_users",
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
				return nil
			}
			completionChan <- completion
			return nil
		})
		if err != nil {
			t.Logf("Completion consumer failed: %v", err)
		}
	}()

	// Start the worker
	workerCfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		RedisURL:    "redis://" + testutils.DefaultRedisAddr + "/0",
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
	case <-time.After(30 * time.Second):
		t.Fatal("Timed out waiting for workflow completion")
	case completion := <-completionChan:
		if completion.Status != messages.CompletionStatusCompleted {
			t.Fatalf("Expected status completed, got %s", completion.Status)
		}

		// Verify aggregated results
		aggOutput, ok := completion.FinalContext["$Aggregate Users"]
		if !ok {
			t.Fatalf("Final context missing $Aggregate Users output. Context keys: %v", getKeys(completion.FinalContext))
		}

		outputMap, ok := aggOutput.(map[string]interface{})
		if !ok {
			t.Fatalf("Aggregate output is not a map: %T", aggOutput)
		}

		aggregated, ok := outputMap["aggregated"].([]interface{})
		if !ok {
			t.Fatalf("Aggregate output missing 'aggregated' field: %v", outputMap)
		}

		if len(aggregated) != len(users) {
			t.Fatalf("Expected %d aggregated items, got %d", len(users), len(aggregated))
		}

		t.Logf("Successfully verified aggregated results: %d items", len(aggregated))
	}
}
