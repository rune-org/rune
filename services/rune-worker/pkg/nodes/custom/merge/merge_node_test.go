package merge

import (
	"context"
	"testing"
	"time"

	redismock "github.com/go-redis/redismock/v9"
	"github.com/redis/go-redis/v9"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
	"rune-worker/plugin"
)

func TestMergeWaitForAllBarrierOpens(t *testing.T) {
	t.Parallel()

	client, mock := redismock.NewClientMock()
	defer func() { _ = client.Close() }()

	wf := core.Workflow{
		Nodes: []core.Node{{ID: "merge1"}},
		Edges: []core.Edge{
			{ID: "e1", Src: "a", Dst: "merge1"},
			{ID: "e2", Src: "b", Dst: "merge1"},
		},
	}

	execCtx := plugin.ExecutionContext{
		ExecutionID:  "exec1",
		NodeID:       "merge1",
		Workflow:     wf,
		Parameters:   map[string]any{"wait_mode": "wait_for_all"},
		Input:        map[string]any{"val": 1},
		FromNode:     "a",
		RedisClient:  client,
		LineageStack: []messages.StackFrame{},
	}

	node := NewMergeNode(execCtx)
	barrierKey := "exec:exec1:node:merge1:barrier"

	mock.ExpectEval(waitForAllScript, []string{barrierKey}, "a", `{"val":1}`, 2).
		SetVal([]interface{}{"a", `{"val":1}`, "b", `{"val":2}`})

	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	merged := out["merged_context"].(map[string]any)
	if merged["val"] != float64(2) {
		t.Fatalf("expected merged val=2, got %v", merged["val"])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet redis expectations: %v", err)
	}
}

func TestMergeWaitForAllWaiting(t *testing.T) {
	t.Parallel()

	client, mock := redismock.NewClientMock()
	defer func() { _ = client.Close() }()

	wf := core.Workflow{
		Nodes: []core.Node{{ID: "merge1"}},
		Edges: []core.Edge{
			{ID: "e1", Src: "a", Dst: "merge1"},
			{ID: "e2", Src: "b", Dst: "merge1"},
		},
	}

	execCtx := plugin.ExecutionContext{
		ExecutionID: "exec1",
		NodeID:      "merge1",
		Workflow:    wf,
		Parameters:  map[string]any{"wait_mode": "wait_for_all"},
		Input:       map[string]any{"val": 1},
		FromNode:    "a",
		RedisClient: client,
	}

	barrierKey := "exec:exec1:node:merge1:barrier"
	mock.ExpectEval(waitForAllScript, []string{barrierKey}, "a", `{"val":1}`, 2).
		SetErr(redis.Nil)
	mock.ExpectSCard(barrierKey + ":arrivals").SetVal(1)

	node := NewMergeNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if waiting := out["_merge_waiting"].(bool); !waiting {
		t.Fatalf("expected waiting true")
	}
	if arrived := out["_merge_arrived"].(int); arrived != 1 {
		t.Fatalf("expected arrived=1 got %d", arrived)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet redis expectations: %v", err)
	}
}

func TestMergeWaitForAnyWinner(t *testing.T) {
	t.Parallel()

	client, mock := redismock.NewClientMock()
	defer func() { _ = client.Close() }()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "exec1",
		NodeID:      "merge1",
		Workflow:    core.Workflow{},
		Parameters:  map[string]any{"wait_mode": "wait_for_any"},
		Input:       map[string]any{"val": 1},
		FromNode:    "a",
		RedisClient: client,
	}

	lockKey := "exec:exec1:node:merge1:lock"
	mock.ExpectSetNX(lockKey, "a", 24*time.Hour).SetVal(true)

	node := NewMergeNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if winner := out["_merge_winner"].(string); winner != "a" {
		t.Fatalf("expected winner a got %s", winner)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet redis expectations: %v", err)
	}
}

func TestMergeWaitForAnyIgnored(t *testing.T) {
	t.Parallel()

	client, mock := redismock.NewClientMock()
	defer client.Close()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "exec1",
		NodeID:      "merge1",
		Workflow:    core.Workflow{},
		Parameters:  map[string]any{"wait_mode": "wait_for_any"},
		Input:       map[string]any{"val": 1},
		FromNode:    "b",
		RedisClient: client,
	}

	lockKey := "exec:exec1:node:merge1:lock"
	mock.ExpectSetNX(lockKey, "b", 24*time.Hour).SetVal(false)

	node := NewMergeNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if ignored := out["_merge_ignored"].(bool); !ignored {
		t.Fatalf("expected branch ignored")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet redis expectations: %v", err)
	}
}

func TestMergeMissingFromNode(t *testing.T) {
	t.Parallel()

	client, _ := redismock.NewClientMock()
	defer client.Close()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "exec1",
		NodeID:      "merge1",
		Workflow: core.Workflow{
			Nodes: []core.Node{{ID: "merge1"}},
			Edges: []core.Edge{{ID: "e1", Src: "a", Dst: "merge1"}},
		},
		Parameters:  map[string]any{"wait_mode": "wait_for_all"},
		Input:       map[string]any{"val": 1},
		RedisClient: client,
	}

	node := NewMergeNode(execCtx)
	if _, err := node.Execute(context.Background(), execCtx); err == nil {
		t.Fatalf("expected error for missing from_node")
	}
}

func TestParseMergeParams(t *testing.T) {
	defaults := parseMergeParams(nil)
	if defaults.TimeoutSeconds != 300 || defaults.Mode != mergeModeAppend || defaults.WaitMode != waitModeAll {
		t.Fatalf("unexpected defaults: %+v", defaults)
	}

	overridden := parseMergeParams(map[string]any{"mode": "append", "wait_mode": waitModeAny, "timeout": "42"})
	if overridden.WaitMode != waitModeAny || overridden.TimeoutSeconds != 42 {
		t.Fatalf("unexpected override: %+v", overridden)
	}
}

func TestDecodeMergeResultsValidatesLength(t *testing.T) {
	if _, err := decodeMergeResults([]interface{}{""}); err == nil {
		t.Fatalf("expected error for odd length slice")
	}
}

func TestBuildMergedContext(t *testing.T) {
	merged, payloads, err := buildMergedContext(map[string]string{"a": `{"foo":1}`}, mergeModeAppend)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(payloads) != 1 || merged["foo"] != float64(1) {
		t.Fatalf("unexpected merged output")
	}
}
