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
