//go:build integration
// +build integration

package e2e

import (
	"context"
	"strings"
	"testing"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/messaging"
	"rune-worker/pkg/platform/config"
	"rune-worker/pkg/platform/queue"

	_ "rune-worker/pkg/nodes/custom/switch"
)

// TestSwitchNodeE2E tests a workflow with a switch node that routes to different HTTP endpoints.
// Scenarios:
// 1. Case 1: Input "google" -> Fetch google.com
// 2. Case 2: Input "yahoo" -> Fetch yahoo.com
// 3. Case 3: Input "bing" -> Fetch bing.com
// 4. Fallback: Input "other" -> Fetch httpbin.org/get (fallback)
func TestSwitchNodeE2E(t *testing.T) {
	env := setupE2ETest(t)
	defer env.Cleanup(t)

	// Define common workflow elements
	workflowID := "test-workflow-switch-e2e"
	switchNodeID := "switch-node-1"
	nodeGoogleID := "http-google"
	nodeYahooID := "http-yahoo"
	nodeBingID := "http-bing"
	nodeFallbackID := "http-fallback"

	edgeGoogle := "edge-google"
	edgeYahoo := "edge-yahoo"
	edgeBing := "edge-bing"
	edgeFallback := "edge-fallback"

	// Define the switch node
	switchNode := core.Node{
		ID:   switchNodeID,
		Name: "Route Request",
		Type: "switch",
		Parameters: map[string]interface{}{
			"rules": []map[string]interface{}{
				{
					"value":    "$target",
					"operator": "==",
					"compare":  "google",
				},
				{
					"value":    "$target",
					"operator": "==",
					"compare":  "yahoo",
				},
				{
					"value":    "$target",
					"operator": "==",
					"compare":  "bing",
				},
			},
			"routes": []interface{}{
				edgeGoogle,
				edgeYahoo,
				edgeBing,
				edgeFallback,
			},
		},
	}

	// Define HTTP nodes
	nodeGoogle := core.Node{
		ID:   nodeGoogleID,
		Name: "Fetch Google",
		Type: "http",
		Parameters: map[string]interface{}{
			"method": "GET",
			"url":    "https://httpbin.org/get?q=google",
		},
	}
	nodeYahoo := core.Node{
		ID:   nodeYahooID,
		Name: "Fetch Yahoo",
		Type: "http",
		Parameters: map[string]interface{}{
			"method": "GET",
			"url":    "https://httpbin.org/get?q=yahoo",
		},
	}
	nodeBing := core.Node{
		ID:   nodeBingID,
		Name: "Fetch Bing",
		Type: "http",
		Parameters: map[string]interface{}{
			"method": "GET",
			"url":    "https://httpbin.org/get?q=bing",
		},
	}
	nodeFallback := core.Node{
		ID:   nodeFallbackID,
		Name: "Fetch Fallback",
		Type: "http",
		Parameters: map[string]interface{}{
			"method": "GET",
			"url":    "https://httpbin.org/get?q=fallback",
		},
	}

	// Define edges
	edges := []core.Edge{
		{ID: edgeGoogle, Src: switchNodeID, Dst: nodeGoogleID},
		{ID: edgeYahoo, Src: switchNodeID, Dst: nodeYahooID},
		{ID: edgeBing, Src: switchNodeID, Dst: nodeBingID},
		{ID: edgeFallback, Src: switchNodeID, Dst: nodeFallbackID},
	}

	// Helper to run a test case
	runTestCase := func(t *testing.T, targetValue string, expectedNodeID string, expectedContent string) {
		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		executionID := "exec-" + targetValue + "-" + time.Now().Format("150405")

		executionMsg := &messages.NodeExecutionMessage{
			WorkflowID:  workflowID,
			ExecutionID: executionID,
			CurrentNode: switchNodeID,
			WorkflowDefinition: core.Workflow{
				WorkflowID:  workflowID,
				ExecutionID: executionID,
				Nodes: []core.Node{
					switchNode,
					nodeGoogle,
					nodeYahoo,
					nodeBing,
					nodeFallback,
				},
				Edges: edges,
			},
			AccumulatedContext: map[string]interface{}{
				"$target": targetValue,
			},
		}

		// Publish execution message
		msgBytes, err := executionMsg.Encode()
		if err != nil {
			t.Fatalf("Failed to encode message: %v", err)
		}

		err = env.Publisher.Publish(ctx, "workflow.execution", msgBytes)
		if err != nil {
			t.Fatalf("Failed to publish message: %v", err)
		}

		// Consumers
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

		completionConsumer, err := queue.NewRabbitMQConsumer(queue.Options{
			URL:         env.RabbitMQURL,
			QueueName:   "workflow.completion",
			Prefetch:    10,
			Concurrency: 1,
		})
		if err != nil {
			t.Fatalf("Failed to create completion consumer: %v", err)
		}
		defer completionConsumer.Close()

		// Start worker
		cfg := &config.WorkerConfig{
			RabbitURL:   env.RabbitMQURL,
			QueueName:   "workflow.execution",
			Prefetch:    1,
			Concurrency: 1,
		}
		worker, err := messaging.NewWorkflowConsumer(cfg)
		if err != nil {
			t.Fatalf("Failed to create worker: %v", err)
		}
		defer worker.Close()

		workerCtx, workerCancel := context.WithTimeout(ctx, 15*time.Second)
		defer workerCancel()
		go worker.Run(workerCtx)

		// Monitor results
		statusMsgs := make([]*messages.NodeStatusMessage, 0)
		var completionMsg *messages.CompletionMessage
		done := make(chan struct{})

		go func() {
			_ = statusConsumer.Consume(ctx, func(ctx context.Context, payload []byte) error {
				msg, err := messages.DecodeNodeStatusMessage(payload)
				if err != nil {
					return nil
				}
				if msg.WorkflowID == workflowID && msg.ExecutionID == executionID {
					statusMsgs = append(statusMsgs, msg)
					logStatusMessage(t, msg, len(statusMsgs), targetValue)
				}
				return nil
			})
		}()

		go func() {
			_ = completionConsumer.Consume(ctx, func(ctx context.Context, payload []byte) error {
				msg, err := messages.DecodeCompletionMessage(payload)
				if err != nil {
					return nil
				}
				if msg.WorkflowID == workflowID && msg.ExecutionID == executionID {
					completionMsg = msg
					logCompletionMessage(t, msg, targetValue)
					close(done)
				}
				return nil
			})
		}()

		// Wait for completion
		select {
		case <-done:
			// Success
		case <-ctx.Done():
			t.Fatal("Test timeout waiting for completion")
		}

		// Verify
		executedSwitch := false
		executedTarget := false

		for _, msg := range statusMsgs {
			if msg.Status == messages.StatusSuccess {
				if msg.NodeID == switchNodeID {
					executedSwitch = true
				}
				if msg.NodeID == expectedNodeID {
					executedTarget = true
					// Verify content if possible (some sites might redirect or have dynamic content)
					if expectedContent != "" && msg.Output != nil {
						if body, ok := msg.Output["body"].(string); ok {
							if !strings.Contains(strings.ToLower(body), strings.ToLower(expectedContent)) {
								t.Logf("Warning: Response body does not contain '%s'", expectedContent)
							}
						}
					}
				}
			}
		}

		if !executedSwitch {
			t.Error("Switch node was not executed")
		}
		if !executedTarget {
			t.Errorf("Expected target node %s was not executed", expectedNodeID)
		}
		if completionMsg.Status != messages.CompletionStatusCompleted {
			t.Errorf("Workflow did not complete successfully: %s", completionMsg.Status)
		}
	}

	// Run scenarios
	t.Run("Case1_Google", func(t *testing.T) {
		runTestCase(t, "google", nodeGoogleID, "google")
	})

	t.Run("Case2_Yahoo", func(t *testing.T) {
		runTestCase(t, "yahoo", nodeYahooID, "yahoo")
	})

	t.Run("Case3_Bing", func(t *testing.T) {
		runTestCase(t, "bing", nodeBingID, "bing")
	})

	t.Run("Fallback_Other", func(t *testing.T) {
		runTestCase(t, "other", nodeFallbackID, "httpbin")
	})
}
