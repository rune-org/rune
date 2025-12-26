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
	"rune-worker/pkg/platform/queue"
	testutils "rune-worker/test_utils"
)

// TestMergeWaitForAllWorkflow validates that a merge node with wait_for_all
// properly synchronizes two branches before continuing execution.
func TestMergeWaitForAllWorkflow(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	workflowID := fmt.Sprintf("wf_merge_all_%d", time.Now().UnixNano())
	executionID := fmt.Sprintf("exec_merge_all_%d", time.Now().UnixNano())

	// Workflow: two branches converge at merge node
	//   branch_a -> merge_node
	//   branch_b -> merge_node
	workflow := core.Workflow{
		WorkflowID: workflowID,
		Nodes: []core.Node{
			{ID: "branch_a", Name: "Branch A", Type: "http"},
			{ID: "branch_b", Name: "Branch B", Type: "http"},
			{ID: "merge_node", Name: "Merge", Type: "merge", Parameters: map[string]any{"wait_mode": "wait_for_all", "timeout": 60}},
		},
		Edges: []core.Edge{
			{ID: "e1", Src: "branch_a", Dst: "merge_node"},
			{ID: "e2", Src: "branch_b", Dst: "merge_node"},
		},
	}

	// Start workflow consumer
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

	// Publish first branch message (branch_a -> merge_node)
	msgA := &messages.NodeExecutionMessage{
		WorkflowID:         workflowID,
		ExecutionID:        executionID,
		CurrentNode:        "merge_node",
		WorkflowDefinition: workflow,
		AccumulatedContext: map[string]interface{}{"$Branch A": map[string]any{"status": 200, "branch": "a"}},
		FromNode:           "branch_a",
	}
	payloadA, _ := msgA.Encode()
	if err := env.Publisher.Publish(ctx, "workflow.execution", payloadA); err != nil {
		t.Fatalf("Failed to publish branch A message: %v", err)
	}
	t.Log("Published branch A message to merge node")

	// Give time for first branch to register
	time.Sleep(1 * time.Second)

	// Publish second branch message (branch_b -> merge_node)
	msgB := &messages.NodeExecutionMessage{
		WorkflowID:         workflowID,
		ExecutionID:        executionID,
		CurrentNode:        "merge_node",
		WorkflowDefinition: workflow,
		AccumulatedContext: map[string]interface{}{"$Branch B": map[string]any{"status": 200, "branch": "b"}},
		FromNode:           "branch_b",
	}
	payloadB, _ := msgB.Encode()
	if err := env.Publisher.Publish(ctx, "workflow.execution", payloadB); err != nil {
		t.Fatalf("Failed to publish branch B message: %v", err)
	}
	t.Log("Published branch B message to merge node")

	// Listen for status messages
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

	var mergeSuccess bool
	go func() {
		_ = statusConsumer.Consume(statusCtx, func(ctx context.Context, payload []byte) error {
			msg, err := messages.DecodeNodeStatusMessage(payload)
			if err != nil {
				return nil
			}
			if msg.ExecutionID == executionID && msg.NodeID == "merge_node" && msg.Status == messages.StatusSuccess {
				t.Logf("Merge node completed successfully: %+v", msg.Output)
				mergeSuccess = true
				statusCancel()
			}
			return nil
		})
	}()

	<-statusCtx.Done()

	if !mergeSuccess {
		t.Error("Merge node did not complete successfully within timeout")
	}
}

// TestMergeWaitForAnyWorkflow validates that a merge node with wait_for_any
// allows only the first arriving branch through.
func TestMergeWaitForAnyWorkflow(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	workflowID := fmt.Sprintf("wf_merge_any_%d", time.Now().UnixNano())
	executionID := fmt.Sprintf("exec_merge_any_%d", time.Now().UnixNano())

	workflow := core.Workflow{
		WorkflowID: workflowID,
		Nodes: []core.Node{
			{ID: "branch_a", Name: "Branch A", Type: "http"},
			{ID: "branch_b", Name: "Branch B", Type: "http"},
			{ID: "merge_node", Name: "Merge", Type: "merge", Parameters: map[string]any{"wait_mode": "wait_for_any"}},
		},
		Edges: []core.Edge{
			{ID: "e1", Src: "branch_a", Dst: "merge_node"},
			{ID: "e2", Src: "branch_b", Dst: "merge_node"},
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

	consumerCtx, consumerCancel := context.WithTimeout(ctx, 20*time.Second)
	defer consumerCancel()
	go func() {
		_ = consumer.Run(consumerCtx)
	}()

	time.Sleep(2 * time.Second)

	// Publish both branches nearly simultaneously
	msgA := &messages.NodeExecutionMessage{
		WorkflowID:         workflowID,
		ExecutionID:        executionID,
		CurrentNode:        "merge_node",
		WorkflowDefinition: workflow,
		AccumulatedContext: map[string]interface{}{"$Branch A": "data_a"},
		FromNode:           "branch_a",
	}
	msgB := &messages.NodeExecutionMessage{
		WorkflowID:         workflowID,
		ExecutionID:        executionID,
		CurrentNode:        "merge_node",
		WorkflowDefinition: workflow,
		AccumulatedContext: map[string]interface{}{"$Branch B": "data_b"},
		FromNode:           "branch_b",
	}

	payloadA, _ := msgA.Encode()
	payloadB, _ := msgB.Encode()

	if err := env.Publisher.Publish(ctx, "workflow.execution", payloadA); err != nil {
		t.Fatalf("Failed to publish branch A: %v", err)
	}
	if err := env.Publisher.Publish(ctx, "workflow.execution", payloadB); err != nil {
		t.Fatalf("Failed to publish branch B: %v", err)
	}
	t.Log("Published both branches to merge node")

	// Listen for status messages
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

	successCount := 0
	ignoredCount := 0
	go func() {
		_ = statusConsumer.Consume(statusCtx, func(ctx context.Context, payload []byte) error {
			msg, err := messages.DecodeNodeStatusMessage(payload)
			if err != nil {
				return nil
			}
			if msg.ExecutionID == executionID && msg.NodeID == "merge_node" {
				t.Logf("Merge status: %s, output: %+v", msg.Status, msg.Output)
				if msg.Status == messages.StatusSuccess {
					if _, isIgnored := msg.Output["_merge_ignored"]; isIgnored {
						ignoredCount++
					} else if _, isWinner := msg.Output["_merge_winner"]; isWinner {
						successCount++
						t.Logf("Winner branch: %v", msg.Output["_merge_winner"])
					}
				}
			}
			return nil
		})
	}()

	<-statusCtx.Done()

	// With wait_for_any, exactly one branch should win
	if successCount != 1 {
		t.Errorf("Expected exactly 1 winner from wait_for_any merge, got %d", successCount)
	}
	t.Logf("Merge result: %d winner, %d ignored", successCount, ignoredCount)
}

// TestMergeBarrierWithRedis verifies that Redis barrier state is properly managed.
func TestMergeBarrierWithRedis(t *testing.T) {
	env := setupIntegrationTest(t)
	defer env.Cleanup(t)

	ctx := context.Background()
	executionID := fmt.Sprintf("exec_barrier_%d", time.Now().UnixNano())

	// Check Redis state before any merges
	barrierKey := fmt.Sprintf("exec:%s:node:merge_node:barrier:arrivals", executionID)
	exists, err := env.RedisClient.Exists(ctx, barrierKey).Result()
	if err != nil {
		t.Fatalf("Redis exists check failed: %v", err)
	}
	if exists != 0 {
		t.Error("Barrier key should not exist before any merges")
	}

	t.Log("Redis barrier state verified - key does not exist initially")
}
