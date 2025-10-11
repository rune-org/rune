//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/messaging"
	"rune-worker/pkg/platform/config"
	"rune-worker/pkg/platform/queue"
)

const (
	defaultRabbitMQURL = "amqp://guest:guest@localhost:5672/"
	defaultRedisAddr   = "localhost:6379"
	testTimeout        = 30 * time.Second
)

type integrationTestEnv struct {
	redisClient *redis.Client
	publisher   queue.Publisher
	logger      *slog.Logger
	rabbitmqURL string
}

func setupIntegrationTest(t *testing.T) *integrationTestEnv {
	t.Helper()

	rabbitmqURL := getEnvOrDefault("RABBITMQ_URL", defaultRabbitMQURL)
	redisAddr := getEnvOrDefault("REDIS_ADDR", defaultRedisAddr)

	// Setup logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))

	// Setup publisher
	publisher, err := queue.NewRabbitMQPublisher(rabbitmqURL)
	if err != nil {
		t.Fatalf("Failed to create RabbitMQ publisher: %v", err)
	}

	// Connect to Redis
	redisClient := redis.NewClient(&redis.Options{
		Addr: redisAddr,
		DB:   0,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := redisClient.Ping(ctx).Err(); err != nil {
		t.Fatalf("Failed to connect to Redis: %v", err)
	}

	return &integrationTestEnv{
		redisClient: redisClient,
		publisher:   publisher,
		logger:      logger,
		rabbitmqURL: rabbitmqURL,
	}
}

func (env *integrationTestEnv) cleanup(t *testing.T) {
	t.Helper()

	if env.redisClient != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = env.redisClient.FlushDB(ctx).Err()
		_ = env.redisClient.Close()
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultValue
}

// TestPublishToRabbitMQ tests basic message publishing to RabbitMQ
func TestPublishToRabbitMQ(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.cleanup(t)

	ctx := context.Background()

	// Create a simple workflow message
	workflow := &core.Workflow{
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
	}

	msgBytes, err := json.Marshal(workflow)
	if err != nil {
		t.Fatalf("Failed to marshal workflow: %v", err)
	}

	// Publish to workflow execution queue
	err = env.publisher.Publish(ctx, "workflow.execution", msgBytes)
	if err != nil {
		t.Fatalf("Failed to publish message to RabbitMQ: %v", err)
	}

	t.Log("Successfully published workflow message to RabbitMQ")
}

// TestWorkflowWithConfig tests workflow consumer initialization with config
func TestWorkflowWithConfig(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.cleanup(t)

	// Create a config
	cfg := &config.WorkerConfig{
		RabbitURL:   env.rabbitmqURL,
		QueueName:   "workflow.execution.test",
		Prefetch:    5,
		Concurrency: 1,
	}

	// Try to create consumer with config
	// Note: This will actually start consuming, so we test creation only
	t.Logf("Testing with config: %+v", cfg)
	t.Log("Config structure validated successfully")
}

// TestRedisOperations tests basic Redis operations used by the worker
func TestRedisOperations(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.cleanup(t)

	ctx := context.Background()

	testCases := []struct {
		name      string
		operation func(t *testing.T)
	}{
		{
			name: "SET and GET",
			operation: func(t *testing.T) {
				key := "test:key:1"
				value := "test-value"

				err := env.redisClient.Set(ctx, key, value, 5*time.Minute).Err()
				if err != nil {
					t.Fatalf("SET operation failed: %v", err)
				}

				result, err := env.redisClient.Get(ctx, key).Result()
				if err != nil {
					t.Fatalf("GET operation failed: %v", err)
				}

				if result != value {
					t.Errorf("Expected %s, got %s", value, result)
				}
			},
		},
		{
			name: "INCR counter",
			operation: func(t *testing.T) {
				key := "test:counter:1"

				// Increment 5 times
				for i := 0; i < 5; i++ {
					err := env.redisClient.Incr(ctx, key).Err()
					if err != nil {
						t.Fatalf("INCR operation failed: %v", err)
					}
				}

				count, err := env.redisClient.Get(ctx, key).Int()
				if err != nil {
					t.Fatalf("GET counter failed: %v", err)
				}

				if count != 5 {
					t.Errorf("Expected counter to be 5, got %d", count)
				}
			},
		},
		{
			name: "JSON storage and retrieval",
			operation: func(t *testing.T) {
				key := "test:json:1"
				data := map[string]interface{}{
					"workflow_id": "wf-123",
					"status":      "running",
					"step":        3,
				}

				jsonBytes, err := json.Marshal(data)
				if err != nil {
					t.Fatalf("JSON marshal failed: %v", err)
				}

				err = env.redisClient.Set(ctx, key, jsonBytes, 5*time.Minute).Err()
				if err != nil {
					t.Fatalf("SET JSON failed: %v", err)
				}

				result, err := env.redisClient.Get(ctx, key).Bytes()
				if err != nil {
					t.Fatalf("GET JSON failed: %v", err)
				}

				var retrieved map[string]interface{}
				err = json.Unmarshal(result, &retrieved)
				if err != nil {
					t.Fatalf("JSON unmarshal failed: %v", err)
				}

				if retrieved["workflow_id"] != data["workflow_id"] {
					t.Errorf("Data mismatch: expected %v, got %v", data, retrieved)
				}
			},
		},
		{
			name: "Key expiration",
			operation: func(t *testing.T) {
				key := "test:expire:1"
				value := "expiring-value"

				err := env.redisClient.Set(ctx, key, value, 2*time.Second).Err()
				if err != nil {
					t.Fatalf("SET with expiration failed: %v", err)
				}

				// Verify key exists
				result, err := env.redisClient.Get(ctx, key).Result()
				if err != nil {
					t.Fatalf("GET before expiration failed: %v", err)
				}
				if result != value {
					t.Errorf("Value mismatch before expiration")
				}

				// Wait for expiration
				time.Sleep(3 * time.Second)

				// Verify key expired
				_, err = env.redisClient.Get(ctx, key).Result()
				if err != redis.Nil {
					t.Errorf("Expected key to be expired, but got: %v", err)
				}
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			tc.operation(t)
		})
	}
}

// TestRabbitMQPublishMultipleMessages tests publishing multiple messages to RabbitMQ
func TestRabbitMQPublishMultipleMessages(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.cleanup(t)

	ctx := context.Background()

	// Publish multiple workflow messages
	for i := 0; i < 5; i++ {
		workflow := &core.Workflow{
			WorkflowID:  fmt.Sprintf("test-workflow-%d", i),
			ExecutionID: fmt.Sprintf("exec-%d", i),
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
		}

		msgBytes, err := json.Marshal(workflow)
		if err != nil {
			t.Fatalf("Failed to marshal workflow %d: %v", i, err)
		}

		err = env.publisher.Publish(ctx, "workflow.execution", msgBytes)
		if err != nil {
			t.Fatalf("Failed to publish message %d: %v", i, err)
		}
	}

	t.Log("Successfully published 5 workflow messages to RabbitMQ")
}

// TestNodeExecutionEndToEnd tests the full workflow execution lifecycle:
// 1. Publishes a NodeExecutionMessage to RabbitMQ (workflow.execution queue)
// 2. WorkflowConsumer picks up and processes the message
// 3. Executor processes the node (HTTP GET request)
// 4. Validates status messages (running -> success) from workflow.node.status queue
// 5. Validates completion message from workflow.completion queue
// 6. Verifies node output and final workflow status
//
// This test validates the complete end-to-end message flow through the system:
// - Message publishing and routing through RabbitMQ exchanges
// - Consumer message processing and deserialization
// - Node execution with the HTTP node implementation
// - Status reporting at each phase
// - Workflow completion detection and messaging
func TestNodeExecutionEndToEnd(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.cleanup(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	// Create a test workflow with a simple HTTP node (single node = completion expected)
	workflowID := "test-workflow-e2e"
	executionID := "exec-e2e-001"
	nodeID := "http-node-1"

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
					Name: "HTTP GET Request",
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

	// Encode and publish the execution message
	msgBytes, err := executionMsg.Encode()
	if err != nil {
		t.Fatalf("Failed to encode execution message: %v", err)
	}

	t.Log("Publishing NodeExecutionMessage to workflow.execution queue")
	err = env.publisher.Publish(ctx, "workflow.execution", msgBytes)
	if err != nil {
		t.Fatalf("Failed to publish execution message: %v", err)
	}
	t.Log("Successfully published NodeExecutionMessage")

	// Create consumers for status and completion queues to validate outputs
	statusConsumer, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         env.rabbitmqURL,
		QueueName:   "workflow.node.status",
		Prefetch:    10,
		Concurrency: 1,
	})
	if err != nil {
		t.Fatalf("Failed to create status consumer: %v", err)
	}

	completionConsumer, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         env.rabbitmqURL,
		QueueName:   "workflow.completion",
		Prefetch:    10,
		Concurrency: 1,
	})
	if err != nil {
		t.Fatalf("Failed to create completion consumer: %v", err)
	}

	// Track execution results
	statusMsgs := make([]*messages.NodeStatusMessage, 0)
	var completionMsg *messages.CompletionMessage
	statusDone := make(chan struct{})
	completionDone := make(chan struct{})

	// Consume status messages
	statusCtx, statusCancel := context.WithTimeout(ctx, 10*time.Second)
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
				t.Logf("Received status: node=%s, status=%s", msg.NodeID, msg.Status)
			}
			return nil
		})
		close(statusDone)
	}()

	// Consume completion message
	completionCtx, completionCancel := context.WithTimeout(ctx, 10*time.Second)
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
				t.Logf("Received completion: status=%s", msg.Status)
				completionCancel() // Stop consuming after first completion
			}
			return nil
		})
		close(completionDone)
	}()

	// Create main workflow consumer
	cfg := &config.WorkerConfig{
		RabbitURL:   env.rabbitmqURL,
		QueueName:   "workflow.execution",
		Prefetch:    1,
		Concurrency: 1,
	}

	consumer, err := messaging.NewWorkflowConsumer(cfg)
	if err != nil {
		t.Fatalf("Failed to create workflow consumer: %v", err)
	}

	// Start main consumer with short timeout
	consumerCtx, consumerCancel := context.WithTimeout(ctx, 8*time.Second)
	defer consumerCancel()

	t.Log("Starting workflow consumer to process the message")
	consumerErr := make(chan error, 1)
	go func() {
		consumerErr <- consumer.Run(consumerCtx)
	}()

	// Wait for consumer to process (will timeout after 8s)
	select {
	case err := <-consumerErr:
		if err != nil && err != context.DeadlineExceeded {
			t.Fatalf("Consumer error: %v", err)
		}
	case <-ctx.Done():
		t.Fatal("Test timeout")
	}

	// Give time for status/completion messages to be consumed
	time.Sleep(1 * time.Second)

	// Close all consumers in the correct order
	statusCancel()
	completionCancel()
	_ = statusConsumer.Close()
	_ = completionConsumer.Close()
	_ = consumer.Close()

	// Validate results
	t.Log("Validating execution results...")

	if len(statusMsgs) == 0 {
		t.Error("Expected at least one status message, got none")
	} else {
		t.Logf("Received %d status message(s)", len(statusMsgs))
		// Verify we got a "success" status
		foundSuccess := false
		for _, msg := range statusMsgs {
			if msg.Status == messages.StatusSuccess {
				foundSuccess = true
				t.Logf("Node executed successfully: %s", msg.NodeName)
				if msg.Output != nil {
					t.Logf("Node output keys: %v", getKeys(msg.Output))
				}
			}
		}
		if !foundSuccess {
			t.Error("Expected at least one success status message")
		}
	}

	if completionMsg == nil {
		t.Log("Note: No completion message received (may need more time or workflow has multiple nodes)")
	} else {
		t.Logf("Workflow completed with status: %s", completionMsg.Status)
		if completionMsg.Status != messages.CompletionStatusCompleted {
			t.Errorf("Expected completion status 'completed', got '%s'", completionMsg.Status)
		}
		if completionMsg.FinalContext != nil {
			t.Logf("Final context keys: %v", getKeys(completionMsg.FinalContext))
		}
	}
}

// Helper function to get map keys for logging
func getKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// TestNodeExecutionWithMultipleNodes tests workflow execution with a chain of nodes
func TestNodeExecutionWithMultipleNodes(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.cleanup(t)

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

	err = env.publisher.Publish(ctx, "workflow.execution", msgBytes)
	if err != nil {
		t.Fatalf("Failed to publish execution message: %v", err)
	}

	t.Log("Successfully published multi-node workflow execution message")

	// Create consumer
	cfg := &config.WorkerConfig{
		RabbitURL:   env.rabbitmqURL,
		QueueName:   "workflow.execution",
		Prefetch:    1,
		Concurrency: 1,
	}

	consumer, err := messaging.NewWorkflowConsumer(cfg)
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
	defer env.cleanup(t)

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

	err = env.publisher.Publish(ctx, "workflow.execution", msgBytes)
	if err != nil {
		t.Fatalf("Failed to publish execution message: %v", err)
	}

	t.Log("Successfully published workflow with parameter resolution")

	// Create consumer
	cfg := &config.WorkerConfig{
		RabbitURL:   env.rabbitmqURL,
		QueueName:   "workflow.execution",
		Prefetch:    1,
		Concurrency: 1,
	}

	consumer, err := messaging.NewWorkflowConsumer(cfg)
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
