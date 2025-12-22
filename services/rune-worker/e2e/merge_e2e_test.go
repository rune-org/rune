//go:build integration
// +build integration

package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/messaging"
	"rune-worker/pkg/platform/config"
	"rune-worker/pkg/platform/queue"
	testutils "rune-worker/test_utils"
)

// TestMergeE2E_WaitForAllComplete tests a complete workflow with split -> merge (wait_for_all).
func TestMergeE2E_WaitForAllComplete(t *testing.T) {
	env := setupE2ETest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	workflowID := fmt.Sprintf("wf_merge_e2e_all_%d", time.Now().UnixNano())
	executionID := fmt.Sprintf("exec_merge_e2e_all_%d", time.Now().UnixNano())

	// Complete workflow: trigger -> split -> [branch_a, branch_b] -> merge -> end
	workflow := core.Workflow{
		WorkflowID: workflowID,
		Nodes: []core.Node{
			{ID: "trigger", Name: "Trigger", Type: "http", Trigger: true, Parameters: map[string]any{"method": "GET", "url": "https://httpbin.org/get"}},
			{ID: "branch_a", Name: "Branch A", Type: "http", Parameters: map[string]any{"method": "GET", "url": "https://httpbin.org/get?branch=a"}},
			{ID: "branch_b", Name: "Branch B", Type: "http", Parameters: map[string]any{"method": "GET", "url": "https://httpbin.org/get?branch=b"}},
			{ID: "merge_node", Name: "Merge All", Type: "merge", Parameters: map[string]any{"wait_mode": "wait_for_all", "timeout": 120}},
			{ID: "end_node", Name: "End", Type: "http", Parameters: map[string]any{"method": "GET", "url": "https://httpbin.org/get?done=true"}},
		},
		Edges: []core.Edge{
			{ID: "e1", Src: "trigger", Dst: "branch_a"},
			{ID: "e2", Src: "trigger", Dst: "branch_b"},
			{ID: "e3", Src: "branch_a", Dst: "merge_node"},
			{ID: "e4", Src: "branch_b", Dst: "merge_node"},
			{ID: "e5", Src: "merge_node", Dst: "end_node"},
		},
	}

	// Start the workflow consumer
	cfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		RedisURL:    "redis://" + testutils.DefaultRedisAddr + "/0",
		QueueName:   "workflow.execution",
		Prefetch:    10,
		Concurrency: 4,
	}

	consumer, err := messaging.NewWorkflowConsumer(cfg, env.RedisClient)
	if err != nil {
		t.Fatalf("Failed to create workflow consumer: %v", err)
	}
	defer consumer.Close()

	consumerCtx, consumerCancel := context.WithTimeout(ctx, 60*time.Second)
	defer consumerCancel()
	go func() {
		_ = consumer.Run(consumerCtx)
	}()

	// Wait for consumer to be ready
	time.Sleep(2 * time.Second)

	// Create completion consumer
	completionConsumer, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         env.RabbitMQURL,
		QueueName:   "workflow.completion",
		Prefetch:    1,
		Concurrency: 1,
	})
	if err != nil {
		t.Fatalf("Failed to create completion consumer: %v", err)
	}
	defer completionConsumer.Close()

	completionChan := make(chan messages.CompletionMessage, 1)
	go func() {
		_ = completionConsumer.Consume(ctx, func(ctx context.Context, payload []byte) error {
			var completion messages.CompletionMessage
			if err := json.Unmarshal(payload, &completion); err != nil {
				return nil
			}
			if completion.WorkflowID == workflowID {
				completionChan <- completion
			}
			return nil
		})
	}()

	// Simulate both branches arriving at merge node
	msgA := &messages.NodeExecutionMessage{
		WorkflowID:         workflowID,
		ExecutionID:        executionID,
		CurrentNode:        "merge_node",
		WorkflowDefinition: workflow,
		AccumulatedContext: map[string]interface{}{
			"$Trigger":  map[string]any{"status": 200},
			"$Branch A": map[string]any{"status": 200, "args": map[string]any{"branch": "a"}},
		},
		FromNode: "branch_a",
	}

	msgB := &messages.NodeExecutionMessage{
		WorkflowID:         workflowID,
		ExecutionID:        executionID,
		CurrentNode:        "merge_node",
		WorkflowDefinition: workflow,
		AccumulatedContext: map[string]interface{}{
			"$Trigger":  map[string]any{"status": 200},
			"$Branch B": map[string]any{"status": 200, "args": map[string]any{"branch": "b"}},
		},
		FromNode: "branch_b",
	}

	payloadA, _ := msgA.Encode()
	payloadB, _ := msgB.Encode()

	// Publish branch A
	if err := env.Publisher.Publish(ctx, "workflow.execution", payloadA); err != nil {
		t.Fatalf("Failed to publish branch A: %v", err)
	}
	t.Log("Published branch A to merge node")

	time.Sleep(500 * time.Millisecond)

	// Publish branch B
	if err := env.Publisher.Publish(ctx, "workflow.execution", payloadB); err != nil {
		t.Fatalf("Failed to publish branch B: %v", err)
	}
	t.Log("Published branch B to merge node")

	// Create status consumer to track progress
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

	statusCtx, statusCancel := context.WithTimeout(ctx, 30*time.Second)
	defer statusCancel()

	mergeCompleted := false
	endNodeCompleted := false
	go func() {
		_ = statusConsumer.Consume(statusCtx, func(ctx context.Context, payload []byte) error {
			msg, err := messages.DecodeNodeStatusMessage(payload)
			if err != nil {
				return nil
			}
			if msg.ExecutionID == executionID {
				t.Logf("Node %s status: %s", msg.NodeID, msg.Status)
				if msg.NodeID == "merge_node" && msg.Status == messages.StatusSuccess {
					if _, waiting := msg.Output["_merge_waiting"]; !waiting {
						mergeCompleted = true
						t.Logf("Merge node completed with output: %+v", msg.Output)
					}
				}
				if msg.NodeID == "end_node" && msg.Status == messages.StatusSuccess {
					endNodeCompleted = true
					statusCancel()
				}
			}
			return nil
		})
	}()

	<-statusCtx.Done()

	if !mergeCompleted {
		t.Error("Merge node did not complete successfully")
	}
	t.Logf("Merge completed: %v, End node completed: %v", mergeCompleted, endNodeCompleted)
}

// TestMergeE2E_WaitForAnyRace tests race condition handling with wait_for_any.
func TestMergeE2E_WaitForAnyRace(t *testing.T) {
	env := setupE2ETest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	workflowID := fmt.Sprintf("wf_merge_e2e_any_%d", time.Now().UnixNano())
	executionID := fmt.Sprintf("exec_merge_e2e_any_%d", time.Now().UnixNano())

	workflow := core.Workflow{
		WorkflowID: workflowID,
		Nodes: []core.Node{
			{ID: "fast_branch", Name: "Fast Branch", Type: "http"},
			{ID: "slow_branch", Name: "Slow Branch", Type: "http"},
			{ID: "merge_node", Name: "Merge Any", Type: "merge", Parameters: map[string]any{"wait_mode": "wait_for_any"}},
			{ID: "next_node", Name: "Next", Type: "http", Parameters: map[string]any{"method": "GET", "url": "https://httpbin.org/get"}},
		},
		Edges: []core.Edge{
			{ID: "e1", Src: "fast_branch", Dst: "merge_node"},
			{ID: "e2", Src: "slow_branch", Dst: "merge_node"},
			{ID: "e3", Src: "merge_node", Dst: "next_node"},
		},
	}

	cfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		RedisURL:    "redis://" + testutils.DefaultRedisAddr + "/0",
		QueueName:   "workflow.execution",
		Prefetch:    10,
		Concurrency: 4,
	}

	consumer, err := messaging.NewWorkflowConsumer(cfg, env.RedisClient)
	if err != nil {
		t.Fatalf("Failed to create workflow consumer: %v", err)
	}
	defer consumer.Close()

	consumerCtx, consumerCancel := context.WithTimeout(ctx, 30*time.Second)
	defer consumerCancel()
	go func() {
		_ = consumer.Run(consumerCtx)
	}()

	time.Sleep(2 * time.Second)

	// Publish fast branch first
	msgFast := &messages.NodeExecutionMessage{
		WorkflowID:         workflowID,
		ExecutionID:        executionID,
		CurrentNode:        "merge_node",
		WorkflowDefinition: workflow,
		AccumulatedContext: map[string]interface{}{"$Fast Branch": map[string]any{"result": "fast"}},
		FromNode:           "fast_branch",
	}
	payloadFast, _ := msgFast.Encode()
	if err := env.Publisher.Publish(ctx, "workflow.execution", payloadFast); err != nil {
		t.Fatalf("Failed to publish fast branch: %v", err)
	}
	t.Log("Published fast branch")

	// Small delay then publish slow branch
	time.Sleep(100 * time.Millisecond)

	msgSlow := &messages.NodeExecutionMessage{
		WorkflowID:         workflowID,
		ExecutionID:        executionID,
		CurrentNode:        "merge_node",
		WorkflowDefinition: workflow,
		AccumulatedContext: map[string]interface{}{"$Slow Branch": map[string]any{"result": "slow"}},
		FromNode:           "slow_branch",
	}
	payloadSlow, _ := msgSlow.Encode()
	if err := env.Publisher.Publish(ctx, "workflow.execution", payloadSlow); err != nil {
		t.Fatalf("Failed to publish slow branch: %v", err)
	}
	t.Log("Published slow branch")

	// Track status messages
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

	statusCtx, statusCancel := context.WithTimeout(ctx, 15*time.Second)
	defer statusCancel()

	winnerCount := 0
	ignoredCount := 0
	var winner string

	go func() {
		_ = statusConsumer.Consume(statusCtx, func(ctx context.Context, payload []byte) error {
			msg, err := messages.DecodeNodeStatusMessage(payload)
			if err != nil {
				return nil
			}
			if msg.ExecutionID == executionID && msg.NodeID == "merge_node" && msg.Status == messages.StatusSuccess {
				if w, ok := msg.Output["_merge_winner"]; ok {
					winner = fmt.Sprint(w)
					winnerCount++
					t.Logf("Winner: %s", winner)
				}
				if _, ignored := msg.Output["_merge_ignored"]; ignored {
					ignoredCount++
					t.Log("Branch was ignored (lost race)")
				}
			}
			return nil
		})
	}()

	<-statusCtx.Done()

	if winnerCount != 1 {
		t.Errorf("Expected exactly 1 winner, got %d", winnerCount)
	}
	if winner != "fast_branch" && winner != "slow_branch" {
		t.Errorf("Winner should be fast_branch or slow_branch, got: %s", winner)
	}
	t.Logf("Race result: winner=%s, winners=%d, ignored=%d", winner, winnerCount, ignoredCount)
}

// TestMergeE2E_ThreeBranchMerge tests merging three branches with wait_for_all.
func TestMergeE2E_ThreeBranchMerge(t *testing.T) {
	env := setupE2ETest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	workflowID := fmt.Sprintf("wf_merge_e2e_three_%d", time.Now().UnixNano())
	executionID := fmt.Sprintf("exec_merge_e2e_three_%d", time.Now().UnixNano())

	workflow := core.Workflow{
		WorkflowID: workflowID,
		Nodes: []core.Node{
			{ID: "branch_1", Name: "Branch 1", Type: "http"},
			{ID: "branch_2", Name: "Branch 2", Type: "http"},
			{ID: "branch_3", Name: "Branch 3", Type: "http"},
			{ID: "merge_node", Name: "Merge Three", Type: "merge", Parameters: map[string]any{"wait_mode": "wait_for_all", "timeout": 60}},
		},
		Edges: []core.Edge{
			{ID: "e1", Src: "branch_1", Dst: "merge_node"},
			{ID: "e2", Src: "branch_2", Dst: "merge_node"},
			{ID: "e3", Src: "branch_3", Dst: "merge_node"},
		},
	}

	cfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		RedisURL:    "redis://" + testutils.DefaultRedisAddr + "/0",
		QueueName:   "workflow.execution",
		Prefetch:    10,
		Concurrency: 4,
	}

	consumer, err := messaging.NewWorkflowConsumer(cfg, env.RedisClient)
	if err != nil {
		t.Fatalf("Failed to create workflow consumer: %v", err)
	}
	defer consumer.Close()

	consumerCtx, consumerCancel := context.WithTimeout(ctx, 30*time.Second)
	defer consumerCancel()
	go func() {
		_ = consumer.Run(consumerCtx)
	}()

	time.Sleep(2 * time.Second)

	// Publish all three branches
	for i := 1; i <= 3; i++ {
		msg := &messages.NodeExecutionMessage{
			WorkflowID:         workflowID,
			ExecutionID:        executionID,
			CurrentNode:        "merge_node",
			WorkflowDefinition: workflow,
			AccumulatedContext: map[string]interface{}{
				fmt.Sprintf("$Branch %d", i): map[string]any{"data": fmt.Sprintf("branch_%d_data", i)},
			},
			FromNode: fmt.Sprintf("branch_%d", i),
		}
		payload, _ := msg.Encode()
		if err := env.Publisher.Publish(ctx, "workflow.execution", payload); err != nil {
			t.Fatalf("Failed to publish branch %d: %v", i, err)
		}
		t.Logf("Published branch %d", i)
		time.Sleep(200 * time.Millisecond)
	}

	// Track status
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

	statusCtx, statusCancel := context.WithTimeout(ctx, 15*time.Second)
	defer statusCancel()

	mergeCompleted := false
	waitingMessages := 0

	go func() {
		_ = statusConsumer.Consume(statusCtx, func(ctx context.Context, payload []byte) error {
			msg, err := messages.DecodeNodeStatusMessage(payload)
			if err != nil {
				return nil
			}
			if msg.ExecutionID == executionID && msg.NodeID == "merge_node" && msg.Status == messages.StatusSuccess {
				if _, waiting := msg.Output["_merge_waiting"]; waiting {
					waitingMessages++
					arrived, _ := msg.Output["_merge_arrived"]
					expected, _ := msg.Output["_merge_expected"]
					t.Logf("Merge waiting: arrived=%v, expected=%v", arrived, expected)
				} else {
					mergeCompleted = true
					t.Logf("Merge completed with all branches: %+v", msg.Output)
					statusCancel()
				}
			}
			return nil
		})
	}()

	<-statusCtx.Done()

	if !mergeCompleted {
		t.Error("Three-branch merge did not complete")
	}
	// First two branches should produce waiting messages, third should complete
	if waitingMessages != 2 {
		t.Logf("Note: Expected 2 waiting messages (from first 2 branches), got %d", waitingMessages)
	}
	t.Logf("Three-branch merge: completed=%v, waiting_messages=%d", mergeCompleted, waitingMessages)
}
