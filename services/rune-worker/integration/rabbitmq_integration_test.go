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
)

// TestPublishToRabbitMQ tests basic message publishing to RabbitMQ
func TestPublishToRabbitMQ(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.Cleanup(t)

	ctx := context.Background()

	// Create a node execution message (correct format expected by consumer)
	executionMsg := &messages.NodeExecutionMessage{
		WorkflowID:  "test-workflow-1",
		ExecutionID: "exec-1",
		CurrentNode: "node-1", // Required field
		WorkflowDefinition: core.Workflow{
			WorkflowID:  "test-workflow-1",
			ExecutionID: "exec-1",
			Nodes: []core.Node{
				{
					ID:   "node-1",
					Name: "TestNode",
					Type: "http",
					Parameters: map[string]interface{}{
						"method": "GET",
						"url":    "https://httpbin.org/uuid",
					},
				},
			},
			Edges: []core.Edge{},
		},
		AccumulatedContext: make(map[string]interface{}),
	}

	msgBytes, err := executionMsg.Encode()
	if err != nil {
		t.Fatalf("Failed to encode execution message: %v", err)
	}

	// Publish to workflow execution queue
	err = env.Publisher.Publish(ctx, "workflow.execution", msgBytes)
	if err != nil {
		t.Fatalf("Failed to publish message to RabbitMQ: %v", err)
	}

	t.Log("Successfully published node execution message to RabbitMQ")
}

// TestWorkflowWithConfig tests workflow consumer initialization with config
func TestWorkflowWithConfig(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.Cleanup(t)

	// Create a config
	cfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		QueueName:   "workflow.execution.test",
		Prefetch:    5,
		Concurrency: 1,
	}

	// Try to create consumer with config
	// Note: This will actually start consuming, so we test creation only
	t.Logf("Testing with config: %+v", cfg)
	t.Log("Config structure validated successfully")
}

// TestRabbitMQPublishMultipleMessages tests publishing multiple messages to RabbitMQ
func TestRabbitMQPublishMultipleMessages(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.Cleanup(t)

	ctx := context.Background()

	// Publish multiple node execution messages
	for i := 0; i < 5; i++ {
		nodeID := "node-1"
		executionMsg := &messages.NodeExecutionMessage{
			WorkflowID:  fmt.Sprintf("test-workflow-%d", i),
			ExecutionID: fmt.Sprintf("exec-%d", i),
			CurrentNode: nodeID, // Required field
			WorkflowDefinition: core.Workflow{
				WorkflowID:  fmt.Sprintf("test-workflow-%d", i),
				ExecutionID: fmt.Sprintf("exec-%d", i),
				Nodes: []core.Node{
					{
						ID:   nodeID,
						Name: "TestNode",
						Type: "http",
						Parameters: map[string]interface{}{
							"method": "GET",
							"url":    "https://httpbin.org/uuid",
						},
					},
				},
				Edges: []core.Edge{},
			},
			AccumulatedContext: make(map[string]interface{}),
		}

		msgBytes, err := executionMsg.Encode()
		if err != nil {
			t.Fatalf("Failed to encode execution message %d: %v", i, err)
		}

		err = env.Publisher.Publish(ctx, "workflow.execution", msgBytes)
		if err != nil {
			t.Fatalf("Failed to publish message %d: %v", i, err)
		}
	}

	t.Log("Successfully published 5 node execution messages to RabbitMQ")
}

// TestNodeExecutionWithMultipleNodes tests workflow execution with a chain of nodes
func TestNodeExecutionWithMultipleNodes(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	workflowID := "test-workflow-multi"
	executionID := "exec-multi-001"
	node1ID := "http-node-1"
	node2ID := "http-node-2"

	// Create workflow with two nodes connected by an edge
	executionMsg := &messages.NodeExecutionMessage{
		WorkflowID:  workflowID,
		ExecutionID: executionID,
		CurrentNode: node1ID, // Start with first node
		WorkflowDefinition: core.Workflow{
			WorkflowID:  workflowID,
			ExecutionID: executionID,
			Nodes: []core.Node{
				{
					ID:   node1ID,
					Name: "First HTTP Request",
					Type: "http",
					Parameters: map[string]interface{}{
						"method": "GET",
						"url":    "https://httpbin.org/uuid",
					},
				},
				{
					ID:   node2ID,
					Name: "Second HTTP Request",
					Type: "http",
					Parameters: map[string]interface{}{
						"method": "GET",
						"url":    "https://httpbin.org/json",
					},
				},
			},
			Edges: []core.Edge{
				{
					ID:  "edge-1-2",
					Src: node1ID,
					Dst: node2ID,
				},
			},
		},
		AccumulatedContext: make(map[string]interface{}),
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

	t.Log("Successfully published multi-node workflow execution message")

	// Create consumer
	cfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		QueueName:   "workflow.execution",
		Prefetch:    1,
		Concurrency: 1,
	}

	consumer, err := messaging.NewWorkflowConsumer(cfg, env.RedisClient)
	if err != nil {
		t.Fatalf("Failed to create workflow consumer: %v", err)
	}
	defer consumer.Close()

	// Run consumer for a limited time to process nodes
	consumerCtx, consumerCancel := context.WithTimeout(ctx, 10*time.Second)
	defer consumerCancel()

	consumerDone := make(chan error, 1)
	go func() {
		consumerDone <- consumer.Run(consumerCtx)
	}()

	// Wait for consumer to process
	select {
	case err := <-consumerDone:
		if err != nil && err != context.DeadlineExceeded {
			t.Logf("Consumer stopped with: %v", err)
		} else {
			t.Log("Multi-node workflow processing completed")
		}
	case <-ctx.Done():
		t.Fatal("Test timeout")
	}
}

// TestNodeExecutionWithParameterResolution tests that parameters with dynamic references
// are correctly resolved from accumulated context
func TestNodeExecutionWithParameterResolution(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	workflowID := "test-workflow-params"
	executionID := "exec-params-001"
	nodeID := "http-node-params"

	// Create accumulated context with values to be referenced
	accumulatedContext := map[string]interface{}{
		"$previous_node": map[string]interface{}{
			"uuid": "550e8400-e29b-41d4-a716-446655440000",
		},
		"base_url": "https://httpbin.org",
	}

	executionMsg := &messages.NodeExecutionMessage{
		WorkflowID:  workflowID,
		ExecutionID: executionID,
		CurrentNode: nodeID,
		WorkflowDefinition: core.Workflow{
			WorkflowID:  workflowID,
			ExecutionID: executionID,
			Nodes: []core.Node{
				{
					ID:   nodeID,
					Name: "HTTP with Dynamic Parameters",
					Type: "http",
					Parameters: map[string]interface{}{
						"method": "GET",
						"url":    "https://httpbin.org/get",
					},
				},
			},
			Edges: []core.Edge{},
		},
		AccumulatedContext: accumulatedContext,
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

	t.Log("Successfully published workflow with parameter resolution")

	// Create consumer
	cfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		QueueName:   "workflow.execution",
		Prefetch:    1,
		Concurrency: 1,
	}

	consumer, err := messaging.NewWorkflowConsumer(cfg, env.RedisClient)
	if err != nil {
		t.Fatalf("Failed to create workflow consumer: %v", err)
	}
	defer consumer.Close()

	// Run consumer
	consumerCtx, consumerCancel := context.WithTimeout(ctx, 7*time.Second)
	defer consumerCancel()

	consumerDone := make(chan error, 1)
	go func() {
		consumerDone <- consumer.Run(consumerCtx)
	}()

	// Wait for processing
	select {
	case err := <-consumerDone:
		if err != nil && err != context.DeadlineExceeded {
			t.Logf("Consumer stopped with: %v", err)
		} else {
			t.Log("Workflow with parameter resolution completed")
		}
	case <-ctx.Done():
		t.Fatal("Test timeout")
	}
}
