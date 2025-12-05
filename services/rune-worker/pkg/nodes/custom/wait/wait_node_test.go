package wait

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
	"rune-worker/plugin"

	"github.com/redis/go-redis/v9"
)

func TestWaitNode_SchedulesTimer(t *testing.T) {
	// Use real Redis for testing
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15, // Use DB 15 for testing
	})
	defer redisClient.Close()

	ctx := context.Background()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping test")
	}

	// Clean up
	redisClient.Del(ctx, "scheduler:timers")
	redisClient.Del(ctx, "scheduler:payloads")
	defer func() {
		redisClient.Del(ctx, "scheduler:timers")
		redisClient.Del(ctx, "scheduler:payloads")
	}()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "exec-1",
		WorkflowID:  "wf-1",
		NodeID:      "wait-1",
		Type:        "wait",
		Parameters: map[string]any{
			"amount": 2,
			"unit":   "seconds",
		},
		Input:       map[string]any{"foo": "bar"},
		RedisClient: redisClient,
		Workflow: core.Workflow{
			WorkflowID:  "wf-1",
			ExecutionID: "exec-1",
			Nodes: []core.Node{
				{ID: "wait-1", Name: "Wait Node", Type: "wait"},
			},
		},
	}

	node := NewWaitNode(execCtx)

	output, err := node.Execute(ctx, execCtx)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Verify output includes timer metadata
	resumeAt, ok := output["resume_at"].(int64)
	if !ok {
		t.Fatalf("resume_at missing or wrong type: %v", output["resume_at"])
	}

	// Resume should be approximately 2 seconds in the future
	expectedMin := time.Now().Add(time.Second).UnixMilli()
	if resumeAt < expectedMin {
		t.Errorf("resume_at %d should be at least %d", resumeAt, expectedMin)
	}

	timerID, ok := output["timer_id"].(string)
	if !ok || timerID == "" {
		t.Errorf("timer_id missing or empty: %v", output["timer_id"])
	}

	// Verify payload was stored
	_, err = redisClient.HGet(ctx, "scheduler:payloads", timerID).Bytes()
	if err != nil {
		t.Errorf("payload should be stored in Redis: %v", err)
	}

	// Verify timer was scheduled
	score, err := redisClient.ZScore(ctx, "scheduler:timers", timerID).Result()
	if err != nil {
		t.Errorf("timer should be scheduled in Redis: %v", err)
	}
	if int64(score) != resumeAt {
		t.Errorf("timer score %v should match resume_at %v", int64(score), resumeAt)
	}
}

func TestWaitNode_RequiresRedisClient(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "exec-1",
		WorkflowID:  "wf-1",
		NodeID:      "wait-1",
		Type:        "wait",
		Parameters: map[string]any{
			"amount": 1,
			"unit":   "seconds",
		},
		RedisClient: nil, // No Redis client
	}

	node := NewWaitNode(execCtx)
	_, err := node.Execute(context.Background(), execCtx)

	if err == nil {
		t.Error("Expected error when Redis client is nil")
	}
}

func TestWaitNode_InvalidRedisClient(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "exec-1",
		WorkflowID:  "wf-1",
		NodeID:      "wait-1",
		Type:        "wait",
		Parameters: map[string]any{
			"amount": 1,
			"unit":   "seconds",
		},
		RedisClient: "not a redis client", // Wrong type
	}

	node := NewWaitNode(execCtx)
	_, err := node.Execute(context.Background(), execCtx)

	if err == nil {
		t.Error("Expected error when Redis client is wrong type")
	}
}

func TestParseInterval_ValidInputs(t *testing.T) {
	tests := []struct {
		name       string
		params     map[string]any
		wantAmount int
		wantUnit   string
	}{
		{
			name:       "default values",
			params:     map[string]any{},
			wantAmount: 1,
			wantUnit:   "seconds",
		},
		{
			name:       "seconds",
			params:     map[string]any{"amount": 5, "unit": "seconds"},
			wantAmount: 5,
			wantUnit:   "seconds",
		},
		{
			name:       "minutes",
			params:     map[string]any{"amount": 10, "unit": "minutes"},
			wantAmount: 10,
			wantUnit:   "minutes",
		},
		{
			name:       "hours",
			params:     map[string]any{"amount": 2, "unit": "hours"},
			wantAmount: 2,
			wantUnit:   "hours",
		},
		{
			name:       "days",
			params:     map[string]any{"amount": 1, "unit": "days"},
			wantAmount: 1,
			wantUnit:   "days",
		},
		{
			name:       "float64 amount",
			params:     map[string]any{"amount": float64(3), "unit": "seconds"},
			wantAmount: 3,
			wantUnit:   "seconds",
		},
		{
			name:       "json.Number amount",
			params:     map[string]any{"amount": json.Number("7"), "unit": "minutes"},
			wantAmount: 7,
			wantUnit:   "minutes",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			amount, unit, err := parseInterval(tt.params)
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}
			if amount != tt.wantAmount {
				t.Errorf("amount = %d, want %d", amount, tt.wantAmount)
			}
			if unit != tt.wantUnit {
				t.Errorf("unit = %s, want %s", unit, tt.wantUnit)
			}
		})
	}
}

func TestParseInterval_InvalidInputs(t *testing.T) {
	tests := []struct {
		name   string
		params map[string]any
	}{
		{
			name:   "negative amount",
			params: map[string]any{"amount": -1},
		},
		{
			name:   "invalid unit",
			params: map[string]any{"unit": "years"},
		},
		{
			name:   "invalid amount type",
			params: map[string]any{"amount": "not a number"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, err := parseInterval(tt.params)
			if err == nil {
				t.Error("Expected error, got nil")
			}
		})
	}
}

func TestConvertToDuration(t *testing.T) {
	tests := []struct {
		amount   int
		unit     string
		expected time.Duration
	}{
		{1, "seconds", time.Second},
		{5, "seconds", 5 * time.Second},
		{1, "minutes", time.Minute},
		{3, "minutes", 3 * time.Minute},
		{1, "hours", time.Hour},
		{2, "hours", 2 * time.Hour},
		{1, "days", 24 * time.Hour},
		{7, "days", 7 * 24 * time.Hour},
		{1, "unknown", time.Second}, // defaults to seconds
	}

	for _, tt := range tests {
		t.Run(tt.unit, func(t *testing.T) {
			result := convertToDuration(tt.amount, tt.unit)
			if result != tt.expected {
				t.Errorf("convertToDuration(%d, %s) = %v, want %v", tt.amount, tt.unit, result, tt.expected)
			}
		})
	}
}

func TestWaitNode_FrozenStateIncludesContext(t *testing.T) {
	// Use real Redis for this test to verify actual payload
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15, // Use DB 15 for testing
	})
	defer redisClient.Close()

	ctx := context.Background()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping integration test")
	}

	// Clean up
	redisClient.Del(ctx, "scheduler:timers")
	redisClient.Del(ctx, "scheduler:payloads")
	defer func() {
		redisClient.Del(ctx, "scheduler:timers")
		redisClient.Del(ctx, "scheduler:payloads")
	}()

	inputContext := map[string]any{
		"$http_node": map[string]any{
			"status": 200,
			"body":   "test response",
		},
	}

	execCtx := plugin.ExecutionContext{
		ExecutionID: "exec-frozen-test",
		WorkflowID:  "wf-frozen-test",
		NodeID:      "wait-frozen",
		Type:        "wait",
		Parameters: map[string]any{
			"amount": 1,
			"unit":   "seconds",
		},
		Input:       inputContext,
		RedisClient: redisClient,
		Workflow: core.Workflow{
			WorkflowID:  "wf-frozen-test",
			ExecutionID: "exec-frozen-test",
			Nodes: []core.Node{
				{ID: "wait-frozen", Name: "Wait Node", Type: "wait"},
				{ID: "next-node", Name: "Next Node", Type: "http"},
			},
			Edges: []core.Edge{
				{ID: "edge-1", Src: "wait-frozen", Dst: "next-node"},
			},
		},
		LineageStack: []messages.StackFrame{
			{SplitNodeID: "split-1", BranchID: "branch-1", ItemIndex: 0, TotalItems: 3},
		},
	}

	node := NewWaitNode(execCtx)
	output, err := node.Execute(ctx, execCtx)
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}

	timerID := output["timer_id"].(string)

	// Retrieve and decode the frozen payload
	payloadBytes, err := redisClient.HGet(ctx, "scheduler:payloads", timerID).Bytes()
	if err != nil {
		t.Fatalf("Failed to get payload: %v", err)
	}

	frozenMsg, err := messages.DecodeNodeExecutionMessage(payloadBytes)
	if err != nil {
		t.Fatalf("Failed to decode frozen message: %v", err)
	}

	// Verify frozen state preserves all context
	if frozenMsg.WorkflowID != execCtx.WorkflowID {
		t.Errorf("WorkflowID mismatch: got %s, want %s", frozenMsg.WorkflowID, execCtx.WorkflowID)
	}
	if frozenMsg.ExecutionID != execCtx.ExecutionID {
		t.Errorf("ExecutionID mismatch: got %s, want %s", frozenMsg.ExecutionID, execCtx.ExecutionID)
	}
	if frozenMsg.CurrentNode != execCtx.NodeID {
		t.Errorf("CurrentNode mismatch: got %s, want %s", frozenMsg.CurrentNode, execCtx.NodeID)
	}
	if len(frozenMsg.LineageStack) != 1 {
		t.Errorf("LineageStack length mismatch: got %d, want 1", len(frozenMsg.LineageStack))
	}
	if frozenMsg.AccumulatedContext["$http_node"] == nil {
		t.Error("AccumulatedContext should contain $http_node")
	}

	// Verify timer is scheduled
	score, err := redisClient.ZScore(ctx, "scheduler:timers", timerID).Result()
	if err != nil {
		t.Fatalf("Failed to get timer score: %v", err)
	}

	resumeAt := output["resume_at"].(int64)
	if int64(score) != resumeAt {
		t.Errorf("Timer score mismatch: got %v, want %v", int64(score), resumeAt)
	}
}
