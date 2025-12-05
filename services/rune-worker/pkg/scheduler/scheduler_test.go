package scheduler

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"

	"github.com/redis/go-redis/v9"
)

// mockPublisher implements queue.Publisher for testing
type mockPublisher struct {
	published [][]byte
	err       error
}

func (m *mockPublisher) Publish(ctx context.Context, queue string, payload []byte) error {
	if m.err != nil {
		return m.err
	}
	m.published = append(m.published, payload)
	return nil
}

func (m *mockPublisher) Close() error {
	return nil
}

func setupTestRedis(t *testing.T) (*redis.Client, func()) {
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15, // Use DB 15 for testing
	})

	ctx := context.Background()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping test")
	}

	// Clean up before test
	redisClient.Del(ctx, TimersKey)
	redisClient.Del(ctx, PayloadsKey)

	cleanup := func() {
		redisClient.Del(ctx, TimersKey)
		redisClient.Del(ctx, PayloadsKey)
		redisClient.Close()
	}

	return redisClient, cleanup
}

func TestScheduler_ProcessesDueTimers(t *testing.T) {
	redisClient, cleanup := setupTestRedis(t)
	defer cleanup()

	ctx := context.Background()
	pub := &mockPublisher{}

	// Create test payload
	msg := &messages.NodeExecutionMessage{
		WorkflowID:  "wf-test",
		ExecutionID: "exec-test",
		CurrentNode: "wait-node",
		WorkflowDefinition: core.Workflow{
			WorkflowID:  "wf-test",
			ExecutionID: "exec-test",
			Nodes: []core.Node{
				{ID: "wait-node", Name: "Wait", Type: "wait"},
			},
		},
		AccumulatedContext: map[string]interface{}{"test": "data"},
	}
	payload, _ := msg.Encode()

	// Schedule a timer that's already due (in the past)
	timerID := "test-timer-1"
	pastTime := time.Now().Add(-time.Second).UnixMilli()

	redisClient.HSet(ctx, PayloadsKey, timerID, payload)
	redisClient.ZAdd(ctx, TimersKey, redis.Z{Score: float64(pastTime), Member: timerID})

	// Create scheduler and poll once
	scheduler := NewScheduler(redisClient, pub, Options{
		PollInterval: time.Second,
		BatchSize:    10,
	})

	err := scheduler.poll(ctx)
	if err != nil {
		t.Fatalf("poll failed: %v", err)
	}

	// Verify message was published
	if len(pub.published) != 1 {
		t.Fatalf("expected 1 published message, got %d", len(pub.published))
	}

	// Verify timer was removed from Redis
	exists, _ := redisClient.ZScore(ctx, TimersKey, timerID).Result()
	if exists != 0 {
		t.Error("timer should have been removed from sorted set")
	}

	_, err = redisClient.HGet(ctx, PayloadsKey, timerID).Result()
	if err != redis.Nil {
		t.Error("payload should have been removed from hash")
	}
}

func TestScheduler_IgnoresFutureTimers(t *testing.T) {
	redisClient, cleanup := setupTestRedis(t)
	defer cleanup()

	ctx := context.Background()
	pub := &mockPublisher{}

	// Schedule a timer in the future
	timerID := "future-timer"
	futureTime := time.Now().Add(time.Hour).UnixMilli()

	payload := []byte(`{"test": "payload"}`)
	redisClient.HSet(ctx, PayloadsKey, timerID, payload)
	redisClient.ZAdd(ctx, TimersKey, redis.Z{Score: float64(futureTime), Member: timerID})

	scheduler := NewScheduler(redisClient, pub, Options{})

	err := scheduler.poll(ctx)
	if err != nil {
		t.Fatalf("poll failed: %v", err)
	}

	// Verify no message was published
	if len(pub.published) != 0 {
		t.Errorf("expected 0 published messages for future timer, got %d", len(pub.published))
	}

	// Verify timer still exists
	_, err = redisClient.ZScore(ctx, TimersKey, timerID).Result()
	if err != nil {
		t.Error("future timer should still exist")
	}
}

func TestScheduler_ProcessesMultipleTimers(t *testing.T) {
	redisClient, cleanup := setupTestRedis(t)
	defer cleanup()

	ctx := context.Background()
	pub := &mockPublisher{}

	// Schedule multiple due timers
	pastTime := time.Now().Add(-time.Second).UnixMilli()
	for i := 0; i < 5; i++ {
		timerID := "multi-timer-" + string(rune('a'+i))
		payload, _ := json.Marshal(map[string]string{"id": timerID})
		redisClient.HSet(ctx, PayloadsKey, timerID, payload)
		redisClient.ZAdd(ctx, TimersKey, redis.Z{Score: float64(pastTime), Member: timerID})
	}

	scheduler := NewScheduler(redisClient, pub, Options{BatchSize: 10})

	err := scheduler.poll(ctx)
	if err != nil {
		t.Fatalf("poll failed: %v", err)
	}

	if len(pub.published) != 5 {
		t.Errorf("expected 5 published messages, got %d", len(pub.published))
	}
}

func TestScheduler_BatchSizeLimit(t *testing.T) {
	redisClient, cleanup := setupTestRedis(t)
	defer cleanup()

	ctx := context.Background()
	pub := &mockPublisher{}

	// Schedule more timers than batch size
	pastTime := time.Now().Add(-time.Second).UnixMilli()
	for i := 0; i < 10; i++ {
		timerID := "batch-timer-" + string(rune('a'+i))
		payload, _ := json.Marshal(map[string]string{"id": timerID})
		redisClient.HSet(ctx, PayloadsKey, timerID, payload)
		redisClient.ZAdd(ctx, TimersKey, redis.Z{Score: float64(pastTime), Member: timerID})
	}

	scheduler := NewScheduler(redisClient, pub, Options{BatchSize: 3})

	err := scheduler.poll(ctx)
	if err != nil {
		t.Fatalf("poll failed: %v", err)
	}

	// Should only process batch size
	if len(pub.published) != 3 {
		t.Errorf("expected 3 published messages (batch size), got %d", len(pub.published))
	}

	// Remaining timers should still exist
	count, _ := redisClient.ZCard(ctx, TimersKey).Result()
	if count != 7 {
		t.Errorf("expected 7 remaining timers, got %d", count)
	}
}

func TestScheduler_HandlesEmptyQueue(t *testing.T) {
	redisClient, cleanup := setupTestRedis(t)
	defer cleanup()

	ctx := context.Background()
	pub := &mockPublisher{}

	scheduler := NewScheduler(redisClient, pub, Options{})

	err := scheduler.poll(ctx)
	if err != nil {
		t.Fatalf("poll should not fail on empty queue: %v", err)
	}

	if len(pub.published) != 0 {
		t.Errorf("expected 0 published messages, got %d", len(pub.published))
	}
}
