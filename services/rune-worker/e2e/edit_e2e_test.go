//go:build integration
// +build integration

package e2e

import (
	"context"
	"testing"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/messaging"
	"rune-worker/pkg/platform/config"
	"rune-worker/pkg/platform/queue"
	testutils "rune-worker/test_utils"
)

// TestEditNodeE2E_SimpleAssignment tests a basic edit node workflow that assigns values
func TestEditNodeE2E_SimpleAssignment(t *testing.T) {
	env := setupE2ETest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	workflowID := "test-workflow-edit-simple"
	executionID := "exec-edit-simple-001"
	editNodeID := "edit-node-1"

	executionMsg := &messages.NodeExecutionMessage{
		WorkflowID:  workflowID,
		ExecutionID: executionID,
		CurrentNode: editNodeID,
		WorkflowDefinition: core.Workflow{
			WorkflowID:  workflowID,
			ExecutionID: executionID,
			Nodes: []core.Node{
				{
					ID:   editNodeID,
					Name: "Transform User Data",
					Type: "edit",
					Parameters: map[string]interface{}{
						"mode": "assignments",
						"assignments": []interface{}{
							map[string]interface{}{"name": "full_name", "value": "{{ $json.first_name + ' ' + $json.last_name }}", "type": "string"},
							map[string]interface{}{"name": "is_active", "value": "true", "type": "boolean"},
							map[string]interface{}{"name": "metadata.source", "value": "api_v2", "type": "string"},
						},
					},
				},
			},
			Edges: []core.Edge{},
		},
		AccumulatedContext: map[string]interface{}{
			"$json": map[string]interface{}{
				"first_name": "John",
				"last_name":  "Doe",
				"email":      "john@example.com",
			},
		},
	}

	// Encode and publish
	msgBytes, err := executionMsg.Encode()
	if err != nil {
		t.Fatalf("Failed to encode execution message: %v", err)
	}

	t.Log("Publishing NodeExecutionMessage for edit workflow")
	err = env.Publisher.Publish(ctx, "workflow.execution", msgBytes)
	if err != nil {
		t.Fatalf("Failed to publish execution message: %v", err)
	}

	// Create status and completion consumers
	statusConsumer, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         env.RabbitMQURL,
		QueueName:   "workflow.node.status",
		Prefetch:    10,
		Concurrency: 1,
	})
	if err != nil {
		t.Fatalf("Failed to create status consumer: %v", err)
	}
	defer statusConsumer.Close()

	completionConsumer, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         env.RabbitMQURL,
		QueueName:   "workflow.completion",
		Prefetch:    10,
		Concurrency: 1,
	})
	if err != nil {
		t.Fatalf("Failed to create completion consumer: %v", err)
	}
	defer completionConsumer.Close()

	// Track messages
	statusMsgs := make([]*messages.NodeStatusMessage, 0)
	var completionMsg *messages.CompletionMessage
	completionDone := make(chan struct{})

	// Consume status messages
	statusCtx, statusCancel := context.WithTimeout(ctx, 15*time.Second)
	defer statusCancel()
	go func() {
		_ = statusConsumer.Consume(statusCtx, func(ctx context.Context, payload []byte) error {
			msg, err := messages.DecodeNodeStatusMessage(payload)
			if err != nil {
				t.Logf("Failed to decode status message: %v", err)
				return nil
			}
			if msg.WorkflowID == workflowID && msg.ExecutionID == executionID {
				statusMsgs = append(statusMsgs, msg)
				logStatusMessage(t, msg, len(statusMsgs), "EDIT SIMPLE")
			}
			return nil
		})
	}()

	// Consume completion message
	completionCtx, completionCancel := context.WithTimeout(ctx, 15*time.Second)
	defer completionCancel()
	go func() {
		_ = completionConsumer.Consume(completionCtx, func(ctx context.Context, payload []byte) error {
			msg, err := messages.DecodeCompletionMessage(payload)
			if err != nil {
				t.Logf("Failed to decode completion message: %v", err)
				return nil
			}
			if msg.WorkflowID == workflowID && msg.ExecutionID == executionID {
				completionMsg = msg
				logCompletionMessage(t, msg, "EDIT SIMPLE")
				close(completionDone)
				completionCancel()
			}
			return nil
		})
	}()

	// Create and start workflow consumer
	cfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		RedisURL:    "redis://" + testutils.DefaultRedisAddr + "/0",
		QueueName:   "workflow.execution",
		Prefetch:    1,
		Concurrency: 1,
	}

	consumer, err := messaging.NewWorkflowConsumer(cfg, env.RedisClient)
	if err != nil {
		t.Fatalf("Failed to create workflow consumer: %v", err)
	}
	defer consumer.Close()

	consumerCtx, consumerCancel := context.WithTimeout(ctx, 12*time.Second)
	defer consumerCancel()

	go func() {
		_ = consumer.Run(consumerCtx)
	}()

	// Wait for completion
	select {
	case <-completionDone:
		t.Log("Received completion message")
	case <-time.After(15 * time.Second):
		t.Fatal("Timed out waiting for completion")
	}

	// Validate results
	if completionMsg == nil {
		t.Fatal("No completion message received")
	}

	if completionMsg.Status != messages.CompletionStatusCompleted {
		t.Errorf("Expected completed status, got %s", completionMsg.Status)
	}

	// Validate final context
	finalCtx := completionMsg.FinalContext
	if finalCtx == nil {
		t.Fatal("Final context is nil")
	}

	jsonData, ok := finalCtx["$json"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected $json in final context, got %+v", finalCtx)
	}

	// Check full_name
	if jsonData["full_name"] != "John Doe" {
		t.Errorf("Expected full_name 'John Doe', got %v", jsonData["full_name"])
	}

	// Check is_active
	if jsonData["is_active"] != true {
		t.Errorf("Expected is_active true, got %v", jsonData["is_active"])
	}

	// Check metadata.source (nested)
	metadata, ok := jsonData["metadata"].(map[string]interface{})
	if !ok {
		t.Errorf("Expected metadata object, got %v", jsonData["metadata"])
	} else if metadata["source"] != "api_v2" {
		t.Errorf("Expected metadata.source 'api_v2', got %v", metadata["source"])
	}

	// Original fields should be preserved
	if jsonData["email"] != "john@example.com" {
		t.Errorf("Expected email 'john@example.com', got %v", jsonData["email"])
	}
}

// TestEditNodeE2E_KeepOnlyMode tests the keep_only mode that filters fields
func TestEditNodeE2E_KeepOnlyMode(t *testing.T) {
	env := setupE2ETest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	workflowID := "test-workflow-edit-keeponly"
	executionID := "exec-edit-keeponly-001"
	editNodeID := "edit-node-keeponly"

	executionMsg := &messages.NodeExecutionMessage{
		WorkflowID:  workflowID,
		ExecutionID: executionID,
		CurrentNode: editNodeID,
		WorkflowDefinition: core.Workflow{
			WorkflowID:  workflowID,
			ExecutionID: executionID,
			Nodes: []core.Node{
				{
					ID:   editNodeID,
					Name: "Filter User Data",
					Type: "edit",
					Parameters: map[string]interface{}{
						"mode": "keep_only",
						"assignments": []interface{}{
							map[string]interface{}{"name": "id", "value": "{{ $json.id }}", "type": "string"},
							map[string]interface{}{"name": "email", "value": "{{ $json.email }}", "type": "string"},
						},
					},
				},
			},
			Edges: []core.Edge{},
		},
		AccumulatedContext: map[string]interface{}{
			"$json": map[string]interface{}{
				"id":       "user-123",
				"email":    "user@example.com",
				"password": "secret_password",
				"role":     "admin",
				"token":    "sensitive_token",
			},
		},
	}

	// Encode and publish
	msgBytes, err := executionMsg.Encode()
	if err != nil {
		t.Fatalf("Failed to encode execution message: %v", err)
	}

	err = env.Publisher.Publish(ctx, "workflow.execution", msgBytes)
	if err != nil {
		t.Fatalf("Failed to publish execution message: %v", err)
	}

	// Create completion consumer
	completionConsumer, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         env.RabbitMQURL,
		QueueName:   "workflow.completion",
		Prefetch:    10,
		Concurrency: 1,
	})
	if err != nil {
		t.Fatalf("Failed to create completion consumer: %v", err)
	}
	defer completionConsumer.Close()

	var completionMsg *messages.CompletionMessage
	completionDone := make(chan struct{})

	completionCtx, completionCancel := context.WithTimeout(ctx, 15*time.Second)
	defer completionCancel()
	go func() {
		_ = completionConsumer.Consume(completionCtx, func(ctx context.Context, payload []byte) error {
			msg, err := messages.DecodeCompletionMessage(payload)
			if err != nil {
				return nil
			}
			if msg.WorkflowID == workflowID && msg.ExecutionID == executionID {
				completionMsg = msg
				close(completionDone)
				completionCancel()
			}
			return nil
		})
	}()

	// Start worker
	cfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		RedisURL:    "redis://" + testutils.DefaultRedisAddr + "/0",
		QueueName:   "workflow.execution",
		Prefetch:    1,
		Concurrency: 1,
	}

	consumer, err := messaging.NewWorkflowConsumer(cfg, env.RedisClient)
	if err != nil {
		t.Fatalf("Failed to create workflow consumer: %v", err)
	}
	defer consumer.Close()

	consumerCtx, consumerCancel := context.WithTimeout(ctx, 12*time.Second)
	defer consumerCancel()
	go func() {
		_ = consumer.Run(consumerCtx)
	}()

	select {
	case <-completionDone:
	case <-time.After(15 * time.Second):
		t.Fatal("Timed out waiting for completion")
	}

	if completionMsg == nil {
		t.Fatal("No completion message received")
	}

	jsonData, ok := completionMsg.FinalContext["$json"].(map[string]interface{})
	if !ok {
		t.Fatal("Expected $json in final context")
	}

	// Should only have id and email
	if len(jsonData) != 2 {
		t.Errorf("Expected 2 fields, got %d: %+v", len(jsonData), jsonData)
	}

	if jsonData["id"] != "user-123" {
		t.Errorf("Expected id 'user-123', got %v", jsonData["id"])
	}

	if jsonData["email"] != "user@example.com" {
		t.Errorf("Expected email 'user@example.com', got %v", jsonData["email"])
	}

	// Sensitive fields should be removed
	if _, exists := jsonData["password"]; exists {
		t.Error("password should not exist in keep_only result")
	}
	if _, exists := jsonData["token"]; exists {
		t.Error("token should not exist in keep_only result")
	}
}

// TestEditNodeE2E_MathOperations tests edit node with mathematical expressions
func TestEditNodeE2E_MathOperations(t *testing.T) {
	env := setupE2ETest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	workflowID := "test-workflow-edit-math"
	executionID := "exec-edit-math-001"
	editNodeID := "edit-node-math"

	executionMsg := &messages.NodeExecutionMessage{
		WorkflowID:  workflowID,
		ExecutionID: executionID,
		CurrentNode: editNodeID,
		WorkflowDefinition: core.Workflow{
			WorkflowID:  workflowID,
			ExecutionID: executionID,
			Nodes: []core.Node{
				{
					ID:   editNodeID,
					Name: "Calculate Order",
					Type: "edit",
					Parameters: map[string]interface{}{
						"mode": "assignments",
						"assignments": []interface{}{
							map[string]interface{}{"name": "subtotal", "value": "{{ $json.quantity * $json.unit_price }}", "type": "number"},
							map[string]interface{}{"name": "tax", "value": "{{ $json.quantity * $json.unit_price * 0.1 }}", "type": "number"},
							map[string]interface{}{"name": "total", "value": "{{ $json.quantity * $json.unit_price * 1.1 }}", "type": "number"},
						},
					},
				},
			},
			Edges: []core.Edge{},
		},
		AccumulatedContext: map[string]interface{}{
			"$json": map[string]interface{}{
				"order_id":   "ORD-123",
				"quantity":   float64(10),
				"unit_price": float64(25.50),
			},
		},
	}

	msgBytes, err := executionMsg.Encode()
	if err != nil {
		t.Fatalf("Failed to encode execution message: %v", err)
	}

	err = env.Publisher.Publish(ctx, "workflow.execution", msgBytes)
	if err != nil {
		t.Fatalf("Failed to publish execution message: %v", err)
	}

	completionConsumer, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         env.RabbitMQURL,
		QueueName:   "workflow.completion",
		Prefetch:    10,
		Concurrency: 1,
	})
	if err != nil {
		t.Fatalf("Failed to create completion consumer: %v", err)
	}
	defer completionConsumer.Close()

	var completionMsg *messages.CompletionMessage
	completionDone := make(chan struct{})

	completionCtx, completionCancel := context.WithTimeout(ctx, 15*time.Second)
	defer completionCancel()
	go func() {
		_ = completionConsumer.Consume(completionCtx, func(ctx context.Context, payload []byte) error {
			msg, err := messages.DecodeCompletionMessage(payload)
			if err != nil {
				return nil
			}
			if msg.WorkflowID == workflowID && msg.ExecutionID == executionID {
				completionMsg = msg
				close(completionDone)
				completionCancel()
			}
			return nil
		})
	}()

	cfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		RedisURL:    "redis://" + testutils.DefaultRedisAddr + "/0",
		QueueName:   "workflow.execution",
		Prefetch:    1,
		Concurrency: 1,
	}

	consumer, err := messaging.NewWorkflowConsumer(cfg, env.RedisClient)
	if err != nil {
		t.Fatalf("Failed to create workflow consumer: %v", err)
	}
	defer consumer.Close()

	consumerCtx, consumerCancel := context.WithTimeout(ctx, 12*time.Second)
	defer consumerCancel()
	go func() {
		_ = consumer.Run(consumerCtx)
	}()

	select {
	case <-completionDone:
	case <-time.After(15 * time.Second):
		t.Fatal("Timed out waiting for completion")
	}

	if completionMsg == nil {
		t.Fatal("No completion message received")
	}

	jsonData, ok := completionMsg.FinalContext["$json"].(map[string]interface{})
	if !ok {
		t.Fatal("Expected $json in final context")
	}

	// 10 * 25.50 = 255.00
	subtotal, ok := jsonData["subtotal"].(float64)
	if !ok || subtotal != 255.0 {
		t.Errorf("Expected subtotal 255.0, got %v", jsonData["subtotal"])
	}

	// 255.00 * 0.1 = 25.50
	tax, ok := jsonData["tax"].(float64)
	if !ok || (tax < 25.49 || tax > 25.51) {
		t.Errorf("Expected tax ~25.50, got %v", jsonData["tax"])
	}

	// 255.00 * 1.1 = 280.50
	total, ok := jsonData["total"].(float64)
	if !ok || (total < 280.49 || total > 280.51) {
		t.Errorf("Expected total ~280.50, got %v", jsonData["total"])
	}
}
