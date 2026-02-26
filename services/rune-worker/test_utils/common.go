package testutils

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"testing"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/redis/go-redis/v9"

	"rune-worker/pkg/platform/queue"
)

const (
	DefaultRabbitMQURL = "amqp://guest:guest@localhost:5672/"
	DefaultRedisAddr   = "localhost:6379"
	TestTimeout        = 30 * time.Second
)

// TestEnv holds shared resources for integration tests
type TestEnv struct {
	RedisClient *redis.Client
	Publisher   queue.Publisher
	Logger      *slog.Logger
	RabbitMQURL string
}

// SetupTestEnv creates a test environment with RabbitMQ and Redis connections
func SetupTestEnv(t *testing.T) *TestEnv {
	t.Helper()

	rabbitmqURL := GetEnvOrDefault("RABBITMQ_URL", DefaultRabbitMQURL)
	redisAddr := GetEnvOrDefault("REDIS_ADDR", DefaultRedisAddr)

	// Setup logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))

	// Setup publisher
	publisher, err := queue.NewRabbitMQPublisher(rabbitmqURL)
	if err != nil {
		t.Fatalf("Failed to create RabbitMQ publisher: %v", err)
	}

	if err := resetRabbitMQQueues(rabbitmqURL); err != nil {
		_ = publisher.Close()
		t.Fatalf("Failed to reset RabbitMQ queues: %v", err)
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

	return &TestEnv{
		RedisClient: redisClient,
		Publisher:   publisher,
		Logger:      logger,
		RabbitMQURL: rabbitmqURL,
	}
}

// Cleanup closes all resources
func (env *TestEnv) Cleanup(t *testing.T) {
	t.Helper()

	if env.RedisClient != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = env.RedisClient.FlushDB(ctx).Err()
		_ = env.RedisClient.Close()
	}
	if env.Publisher != nil {
		_ = env.Publisher.Close()
	}
}

func resetRabbitMQQueues(rabbitURL string) error {
	conn, err := amqp.Dial(rabbitURL)
	if err != nil {
		return fmt.Errorf("dial rabbitmq: %w", err)
	}
	defer func() { _ = conn.Close() }()

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("open channel: %w", err)
	}
	defer func() { _ = ch.Close() }()

	if err := ch.ExchangeDeclare(
		queue.ExchangeWorkflows,
		"topic",
		true,
		false,
		false,
		false,
		nil,
	); err != nil {
		return fmt.Errorf("declare exchange: %w", err)
	}

	queues := []string{
		queue.QueueWorkflowExecution,
		queue.QueueWorkflowResume,
		queue.QueueWorkflowNodeStatus,
		queue.QueueWorkflowCompletion,
		queue.QueueWorkflowWorkerInitiated,
		queue.QueueWorkflowExecution + ".test",
	}

	for _, q := range queues {
		if _, err := ch.QueueDeclare(
			q,
			true,
			false,
			false,
			false,
			nil,
		); err != nil {
			return fmt.Errorf("declare queue %s: %w", q, err)
		}
		if err := ch.QueueBind(
			q,
			q,
			queue.ExchangeWorkflows,
			false,
			nil,
		); err != nil {
			return fmt.Errorf("bind queue %s: %w", q, err)
		}
		if _, err := ch.QueuePurge(q, false); err != nil {
			return fmt.Errorf("purge queue %s: %w", q, err)
		}
	}

	return nil
}

// GetEnvOrDefault returns environment variable value or default if not set
func GetEnvOrDefault(key, defaultValue string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultValue
}

// GetKeys returns the keys from a map for logging purposes
func GetKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
