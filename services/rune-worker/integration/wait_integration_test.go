//go:build integration

package integration

import (
	"context"
	"testing"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/platform/queue"
	"rune-worker/pkg/scheduler"
	testutils "rune-worker/test_utils"

	"github.com/redis/go-redis/v9"
)

func TestWaitNodeIntegration(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	redisAddr := testutils.GetEnvOrDefault("REDIS_ADDR", testutils.DefaultRedisAddr)
	redisClient := redis.NewClient(&redis.Options{
		Addr: redisAddr,
		DB:   15,
	})
	defer redisClient.Close()

	if err := redisClient.Ping(ctx).Err(); err != nil {
		t.Fatalf("Failed to connect to Redis: %v", err)
	}

	redisClient.Del(ctx, scheduler.TimersKey)
	redisClient.Del(ctx, scheduler.PayloadsKey)
	defer func() {
		redisClient.Del(ctx, scheduler.TimersKey)
		redisClient.Del(ctx, scheduler.PayloadsKey)
	}()

	rabbitmqURL := testutils.GetEnvOrDefault("RABBITMQ_URL", testutils.DefaultRabbitMQURL)
	publisher, err := queue.NewRabbitMQPublisher(rabbitmqURL)
	if err != nil {
		t.Fatalf("Failed to create publisher: %v", err)
	}
	defer publisher.Close()

	timerID := "integration-test-timer"
	resumeTime := time.Now().Add(-time.Second).UnixMilli()

	frozenMsg := &messages.NodeExecutionMessage{
		WorkflowID:  "wf-integration",
		ExecutionID: "exec-integration",
		CurrentNode: "wait-1",
		WorkflowDefinition: core.Workflow{
			WorkflowID:  "wf-integration",
			ExecutionID: "exec-integration",
			Nodes: []core.Node{
				{ID: "wait-1", Name: "Wait Node", Type: "wait"},
			},
			Edges: []core.Edge{},
		},
		AccumulatedContext: map[string]interface{}{},
	}

	payload, err := frozenMsg.Encode()
	if err != nil {
		t.Fatalf("Failed to encode message: %v", err)
	}

	pipe := redisClient.TxPipeline()
	pipe.HSet(ctx, scheduler.PayloadsKey, timerID, payload)
	pipe.ZAdd(ctx, scheduler.TimersKey, redis.Z{Score: float64(resumeTime), Member: timerID})
	if _, err := pipe.Exec(ctx); err != nil {
		t.Fatalf("Failed to store timer: %v", err)
	}

	sched := scheduler.NewScheduler(redisClient, publisher, scheduler.Options{
		PollInterval: 100 * time.Millisecond,
	})

	schedCtx, schedCancel := context.WithTimeout(ctx, 2*time.Second)
	defer schedCancel()
	go func() {
		_ = sched.Run(schedCtx)
	}()

	time.Sleep(500 * time.Millisecond)

	_, err = redisClient.ZScore(ctx, scheduler.TimersKey, timerID).Result()
	if err != redis.Nil {
		t.Errorf("Timer should have been removed: %v", err)
	}

	t.Log("Wait node integration test passed")
}
