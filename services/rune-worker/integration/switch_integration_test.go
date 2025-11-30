//go:build integration
// +build integration

package integration

import (
	"context"
	"testing"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/messaging"
	"rune-worker/pkg/nodes"
	"rune-worker/pkg/platform/config"
	"rune-worker/pkg/platform/queue"
	"rune-worker/plugin"
	testutils "rune-worker/test_utils"

	_ "rune-worker/pkg/nodes/custom/switch"
)

type mockNode struct{}

func (n *mockNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	return map[string]any{}, nil
}

func init() {
	nodes.RegisterNodeType(func(reg *nodes.Registry) {
		reg.Register("mock", func(execCtx plugin.ExecutionContext) plugin.Node {
			return &mockNode{}
		})
	})
}

// TestSwitchNodeRouting tests the routing logic of the Switch Node within the messaging system.
func TestSwitchNodeRouting(t *testing.T) {
	env := testutils.SetupTestEnv(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	workflowID := "test-workflow-switch-integration"
	executionID := "exec-switch-integration-001"
	switchNodeID := "switch-node-1"

	// Define edges
	edgeCase1 := "edge-case-1"
	edgeCase2 := "edge-case-2"
	edgeFallback := "edge-fallback"

	// Define the switch node
	switchNode := core.Node{
		ID:   switchNodeID,
		Name: "Switch Logic",
		Type: "switch",
		Parameters: map[string]interface{}{
			"rules": []map[string]interface{}{
				{
					"value":    "$input.value",
					"operator": "==",
					"compare":  "case1",
				},
				{
					"value":    "$input.value",
					"operator": "==",
					"compare":  "case2",
				},
			},
			"routes": []interface{}{
				edgeCase1,
				edgeCase2,
				edgeFallback,
			},
		},
	}

	// Test Case 1: Match First Rule
	t.Run("MatchFirstRule", func(t *testing.T) {
		executionMsg := &messages.NodeExecutionMessage{
			WorkflowID:  workflowID,
			ExecutionID: executionID + "-case1",
			CurrentNode: switchNodeID,
			WorkflowDefinition: core.Workflow{
				WorkflowID:  workflowID,
				ExecutionID: executionID + "-case1",
				Nodes: []core.Node{
					switchNode,
					{ID: "node-case1", Name: "Case 1 Node", Type: "mock"},
					{ID: "node-case2", Name: "Case 2 Node", Type: "mock"},
					{ID: "node-fallback", Name: "Fallback Node", Type: "mock"},
				},
				Edges: []core.Edge{
					{ID: edgeCase1, Src: switchNodeID, Dst: "node-case1"},
					{ID: edgeCase2, Src: switchNodeID, Dst: "node-case2"},
					{ID: edgeFallback, Src: switchNodeID, Dst: "node-fallback"},
				},
			},
			AccumulatedContext: map[string]interface{}{
				"$input": map[string]interface{}{
					"value": "case1",
				},
			},
		}

		publishAndVerifyRouting(t, env, ctx, executionMsg, "node-case1", workflowID, switchNodeID)
	})

	// Test Case 2: Match Second Rule
	t.Run("MatchSecondRule", func(t *testing.T) {
		executionMsg := &messages.NodeExecutionMessage{
			WorkflowID:  workflowID,
			ExecutionID: executionID + "-case2",
			CurrentNode: switchNodeID,
			WorkflowDefinition: core.Workflow{
				WorkflowID:  workflowID,
				ExecutionID: executionID + "-case2",
				Nodes: []core.Node{
					switchNode,
					{ID: "node-case1", Name: "Case 1 Node", Type: "mock"},
					{ID: "node-case2", Name: "Case 2 Node", Type: "mock"},
					{ID: "node-fallback", Name: "Fallback Node", Type: "mock"},
				},
				Edges: []core.Edge{
					{ID: edgeCase1, Src: switchNodeID, Dst: "node-case1"},
					{ID: edgeCase2, Src: switchNodeID, Dst: "node-case2"},
					{ID: edgeFallback, Src: switchNodeID, Dst: "node-fallback"},
				},
			},
			AccumulatedContext: map[string]interface{}{
				"$input": map[string]interface{}{
					"value": "case2",
				},
			},
		}

		publishAndVerifyRouting(t, env, ctx, executionMsg, "node-case2", workflowID, switchNodeID)
	})

	// Test Case 3: Fallback
	t.Run("Fallback", func(t *testing.T) {
		executionMsg := &messages.NodeExecutionMessage{
			WorkflowID:  workflowID,
			ExecutionID: executionID + "-fallback",
			CurrentNode: switchNodeID,
			WorkflowDefinition: core.Workflow{
				WorkflowID:  workflowID,
				ExecutionID: executionID + "-fallback",
				Nodes: []core.Node{
					switchNode,
					{ID: "node-case1", Name: "Case 1 Node", Type: "mock"},
					{ID: "node-case2", Name: "Case 2 Node", Type: "mock"},
					{ID: "node-fallback", Name: "Fallback Node", Type: "mock"},
				},
				Edges: []core.Edge{
					{ID: edgeCase1, Src: switchNodeID, Dst: "node-case1"},
					{ID: edgeCase2, Src: switchNodeID, Dst: "node-case2"},
					{ID: edgeFallback, Src: switchNodeID, Dst: "node-fallback"},
				},
			},
			AccumulatedContext: map[string]interface{}{
				"$input": map[string]interface{}{
					"value": "something_else",
				},
			},
		}

		publishAndVerifyRouting(t, env, ctx, executionMsg, "node-fallback", workflowID, switchNodeID)
	})
}

func publishAndVerifyRouting(t *testing.T, env *testutils.TestEnv, ctx context.Context, msg *messages.NodeExecutionMessage, expectedNextNodeID string, workflowID string, switchNodeID string) {
	// Let's use the messaging.NewWorkflowConsumer to process the message.
	// And use a separate consumer to listen to workflow.node.status.

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

	statusMsgs := make(chan *messages.NodeStatusMessage, 10)

	go func() {
		_ = statusConsumer.Consume(ctx, func(ctx context.Context, payload []byte) error {
			msg, err := messages.DecodeNodeStatusMessage(payload)
			if err != nil {
				return nil
			}
			if msg.WorkflowID == workflowID {
				statusMsgs <- msg
			}
			return nil
		})
	}()

	// Create worker config manually since env.Config is not available
	workerConfig := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		RedisURL:    "redis://" + testutils.DefaultRedisAddr + "/0",
		QueueName:   "workflow.execution",
		Prefetch:    1,
		Concurrency: 1,
	}

	consumer, err := messaging.NewWorkflowConsumer(workerConfig, env.RedisClient)
	if err != nil {
		t.Fatalf("Failed to create worker: %v", err)
	}
	defer consumer.Close()

	// Run worker in background
	go consumer.Run(ctx)

	// Wait a bit for consumers to be ready
	time.Sleep(100 * time.Millisecond)

	// Publish message
	msgBytes, err := msg.Encode()
	if err != nil {
		t.Fatalf("Failed to encode message: %v", err)
	}

	err = env.Publisher.Publish(ctx, "workflow.execution", msgBytes)
	if err != nil {
		t.Fatalf("Failed to publish message: %v", err)
	}

	// Wait for status messages
	timeout := time.After(5 * time.Second)

	var switchExecuted, nextNodeExecuted bool

	for {
		select {
		case msg := <-statusMsgs:
			if msg.NodeID == switchNodeID {
				switchExecuted = true
				t.Logf("Switch node executed. Output: %v", msg.Output)
			} else if msg.NodeID == expectedNextNodeID {
				nextNodeExecuted = true
				t.Logf("Expected next node executed: %s", msg.NodeID)
			}

			if switchExecuted && nextNodeExecuted {
				return // Success!
			}
		case <-timeout:
			t.Fatalf("Timeout waiting for execution. Switch: %v, Next: %v", switchExecuted, nextNodeExecuted)
		case <-ctx.Done():
			return
		}
	}
}
