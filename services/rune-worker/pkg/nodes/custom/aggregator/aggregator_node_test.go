package aggregatornode

import (
	"context"
	"encoding/json"
	"testing"

	redismock "github.com/go-redis/redismock/v9"
	"github.com/redis/go-redis/v9"

	"rune-worker/pkg/messages"
	"rune-worker/plugin"
)

func TestAggregatorNode_BarrierOpen(t *testing.T) {
	t.Parallel()

	mockClient, mock := redismock.NewClientMock()
	defer mockClient.Close()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "exec-open",
		NodeID:      "aggregator_node",
		Input: map[string]any{
			"value": "foo",
		},
		RedisClient: mockClient,
		LineageStack: []messages.StackFrame{
			{
				SplitNodeID: "split-users",
				BranchID:    "branch-0",
				ItemIndex:   0,
				TotalItems:  2,
			},
		},
	}

	node := NewAggregatorNode(execCtx)

	payloadBytes, err := json.Marshal(execCtx.Input)
	if err != nil {
		t.Fatalf("failed to marshal input: %v", err)
	}

	keys := []string{
		"exec:exec-open:split:split-users:results",
		"exec:exec-open:split:split-users:count",
		"exec:exec-open:split:split-users:expected",
	}

	mock.ExpectEval(aggregateScript, keys, execCtx.LineageStack[0].ItemIndex, string(payloadBytes)).SetVal(`[{"result":"ok"}]`)

	output, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	aggregated, ok := output["aggregated"].([]any)
	if !ok {
		t.Fatalf("expected aggregated slice, got %T", output["aggregated"])
	}

	if len(aggregated) != 1 {
		t.Fatalf("expected 1 aggregated item, got %d", len(aggregated))
	}

	first, ok := aggregated[0].(map[string]any)
	if !ok {
		t.Fatalf("expected aggregated entry to be map, got %T", aggregated[0])
	}

	if first["result"] != "ok" {
		t.Fatalf("expected aggregated result 'ok', got %v", first["result"])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet redis expectations: %v", err)
	}
}

func TestAggregatorNode_BarrierWaiting(t *testing.T) {
	t.Parallel()

	mockClient, mock := redismock.NewClientMock()
	defer mockClient.Close()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "exec-wait",
		NodeID:      "aggregator_node",
		Input: map[string]any{
			"value": "bar",
		},
		RedisClient: mockClient,
		LineageStack: []messages.StackFrame{
			{
				SplitNodeID: "split-orders",
				BranchID:    "branch-1",
				ItemIndex:   1,
				TotalItems:  3,
			},
		},
	}

	node := NewAggregatorNode(execCtx)

	payloadBytes, err := json.Marshal(execCtx.Input)
	if err != nil {
		t.Fatalf("failed to marshal input: %v", err)
	}

	keys := []string{
		"exec:exec-wait:split:split-orders:results",
		"exec:exec-wait:split:split-orders:count",
		"exec:exec-wait:split:split-orders:expected",
	}

	mock.ExpectEval(aggregateScript, keys, execCtx.LineageStack[0].ItemIndex, string(payloadBytes)).SetErr(redis.Nil)
	mock.ExpectGet(keys[1]).SetVal("2")

	output, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if closed, _ := output["_barrier_closed"].(bool); !closed {
		t.Fatalf("expected barrier closed flag to be true")
	}

	processed, ok := output["_aggregator_processed_count"].(int)
	if !ok {
		t.Fatalf("expected processed count int, got %T", output["_aggregator_processed_count"])
	}

	if processed != 2 {
		t.Fatalf("expected processed count 2, got %d", processed)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet redis expectations: %v", err)
	}
}

func TestAggregatorNode_MissingLineageStack(t *testing.T) {
	t.Parallel()

	mockClient, _ := redismock.NewClientMock()
	defer mockClient.Close()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "exec-nolineage",
		NodeID:      "aggregator_node",
		Input:       map[string]any{},
		RedisClient: mockClient,
	}

	node := NewAggregatorNode(execCtx)

	if _, err := node.Execute(context.Background(), execCtx); err == nil {
		t.Fatalf("expected error when lineage stack is missing")
	}
}
