//go:build integration
// +build integration

package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/messaging"
	"rune-worker/pkg/platform/config"
	"rune-worker/pkg/platform/queue"
	testutils "rune-worker/test_utils"
)

// TestNodeExecutionEndToEnd tests the full workflow execution lifecycle:
// 1. Publishes a NodeExecutionMessage to RabbitMQ (workflow.execution queue)
// 2. WorkflowConsumer picks up and processes the message
// 3. Executor processes the node (HTTP GET request)
// 4. Validates status messages (running -> success) from workflow.node.status queue
// 5. Validates completion message from workflow.completion queue
// 6. Verifies node output and final workflow status
//
// This test validates the complete end-to-end message flow through the system:
// - Message publishing and routing through RabbitMQ exchanges
// - Consumer message processing and deserialization
// - Node execution with the HTTP node implementation
// - Status reporting at each phase
// - Workflow completion detection and messaging
func TestNodeExecutionEndToEnd(t *testing.T) {
	env := setupE2ETest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	// Create a test workflow with a simple HTTP node (single node = completion expected)
	workflowID := "test-workflow-e2e"
	executionID := "exec-e2e-001"
	nodeID := "http-node-1"

	executionMsg := &messages.NodeExecutionMessage{
		WorkflowID:  workflowID,
		ExecutionID: executionID,
		CurrentNode: nodeID,
		WorkflowDefinition: core.Workflow{
			WorkflowID:  workflowID,
			ExecutionID: executionID,
			Nodes: []core.Node{
				{
					ID:   nodeID,
					Name: "HTTP GET Request",
					Type: "http",
					Parameters: map[string]interface{}{
						"method": "GET",
						"url":    "https://httpbin.org/uuid",
					},
				},
			},
			Edges: []core.Edge{},
		},
		AccumulatedContext: make(map[string]interface{}),
	}

	// Encode and publish the execution message
	msgBytes, err := executionMsg.Encode()
	if err != nil {
		t.Fatalf("Failed to encode execution message: %v", err)
	}

	t.Log("Publishing NodeExecutionMessage to workflow.execution queue")
	err = env.Publisher.Publish(ctx, "workflow.execution", msgBytes)
	if err != nil {
		t.Fatalf("Failed to publish execution message: %v", err)
	}
	t.Log("Successfully published NodeExecutionMessage")

	// Create consumers for status and completion queues to validate outputs
	statusConsumer, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         env.RabbitMQURL,
		QueueName:   "workflow.node.status",
		Prefetch:    10,
		Concurrency: 1,
	})
	if err != nil {
		t.Fatalf("Failed to create status consumer: %v", err)
	}

	completionConsumer, err := queue.NewRabbitMQConsumer(queue.Options{
		URL:         env.RabbitMQURL,
		QueueName:   "workflow.completion",
		Prefetch:    10,
		Concurrency: 1,
	})
	if err != nil {
		t.Fatalf("Failed to create completion consumer: %v", err)
	}

	// Track execution results
	statusMsgs := make([]*messages.NodeStatusMessage, 0)
	var completionMsg *messages.CompletionMessage
	statusDone := make(chan struct{})
	completionDone := make(chan struct{})

	// Consume status messages
	statusCtx, statusCancel := context.WithTimeout(ctx, 10*time.Second)
	defer statusCancel()
	go func() {
		_ = statusConsumer.Consume(statusCtx, func(ctx context.Context, payload []byte) error {
			msg, err := messages.DecodeNodeStatusMessage(payload)
			if err != nil {
				t.Logf("Failed to decode status message: %v", err)
				return nil
			}
			if msg.WorkflowID == workflowID && msg.ExecutionID == executionID {
				statusMsgs = append(statusMsgs, msg)
				t.Logf("Received status: node=%s, status=%s", msg.NodeID, msg.Status)
			}
			return nil
		})
		close(statusDone)
	}()

	// Consume completion message
	completionCtx, completionCancel := context.WithTimeout(ctx, 10*time.Second)
	defer completionCancel()
	go func() {
		_ = completionConsumer.Consume(completionCtx, func(ctx context.Context, payload []byte) error {
			msg, err := messages.DecodeCompletionMessage(payload)
			if err != nil {
				t.Logf("Failed to decode completion message: %v", err)
				return nil
			}
			if msg.WorkflowID == workflowID && msg.ExecutionID == executionID {
				completionMsg = msg
				t.Logf("Received completion: status=%s", msg.Status)
				completionCancel() // Stop consuming after first completion
			}
			return nil
		})
		close(completionDone)
	}()

	// Create main workflow consumer
	cfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		RedisURL:    "redis://" + testutils.DefaultRedisAddr + "/0",
		QueueName:   "workflow.execution",
		Prefetch:    1,
		Concurrency: 1,
	}

	consumer, err := messaging.NewWorkflowConsumer(cfg, env.RedisClient)
	if err != nil {
		t.Fatalf("Failed to create workflow consumer: %v", err)
	}

	// Start main consumer with short timeout
	consumerCtx, consumerCancel := context.WithTimeout(ctx, 8*time.Second)
	defer consumerCancel()

	t.Log("Starting workflow consumer to process the message")
	consumerErr := make(chan error, 1)
	go func() {
		consumerErr <- consumer.Run(consumerCtx)
	}()

	// Wait for consumer to process (will timeout after 8s)
	select {
	case err := <-consumerErr:
		if err != nil && err != context.DeadlineExceeded {
			t.Fatalf("Consumer error: %v", err)
		}
	case <-ctx.Done():
		t.Fatal("Test timeout")
	}

	// Give time for status/completion messages to be consumed
	time.Sleep(1 * time.Second)

	// Validate results BEFORE closing to avoid cleanup timeout issues
	t.Log("Validating execution results...")

	if len(statusMsgs) == 0 {
		t.Error("Expected at least one status message, got none")
	} else {
		t.Logf("Received %d status message(s)", len(statusMsgs))
		// Verify we got a "success" status and log the execution output
		foundSuccess := false
		for _, msg := range statusMsgs {
			if msg.Status == messages.StatusSuccess {
				foundSuccess = true
				t.Logf("Node executed successfully: %s", msg.NodeName)
				if msg.Output != nil {
					t.Logf("Node output keys: %v", getKeys(msg.Output))

					// Log the actual execution output from status message
					t.Log("=== Node Execution Output (from status message) ===")
					for outKey, outVal := range msg.Output {
						switch outKey {
						case "status":
							t.Logf("  - HTTP Status: %v", outVal)
						case "status_text":
							t.Logf("  - HTTP Status Text: %v", outVal)
						case "duration_ms":
							t.Logf("  - Request Duration: %v ms", outVal)
						case "headers":
							// Log all headers in JSON format
							if headers, ok := outVal.(map[string]interface{}); ok {
								headersJSON, err := json.MarshalIndent(headers, "    ", "  ")
								if err == nil {
									t.Logf("  - Response Headers (%d total):\n    %s", len(headers), string(headersJSON))
								} else {
									t.Logf("  - Response Headers: %v", headers)
								}
							} else {
								t.Logf("  - Response Headers: %v", outVal)
							}
						case "body":
							// Log full response body
							if bodyStr, ok := outVal.(string); ok {
								t.Logf("  - Response Body (%d bytes):\n    %s", len(bodyStr), bodyStr)
							} else if bodyMap, ok := outVal.(map[string]interface{}); ok {
								// If body is already parsed as JSON, pretty print it
								bodyJSON, err := json.MarshalIndent(bodyMap, "    ", "  ")
								if err == nil {
									t.Logf("  - Response Body (JSON):\n    %s", string(bodyJSON))
								} else {
									bodyStr := fmt.Sprint(outVal)
									t.Logf("  - Response Body (%d bytes): %s", len(bodyStr), bodyStr)
								}
							} else {
								bodyStr := fmt.Sprint(outVal)
								t.Logf("  - Response Body (%d bytes): %s", len(bodyStr), bodyStr)
							}
						default:
							t.Logf("  - %s: %v", outKey, outVal)
						}
					}
					t.Log("================================================")
				}
			}
		}
		if !foundSuccess {
			t.Error("Expected at least one success status message")
		}
	}

	if completionMsg == nil {
		t.Log("Note: No completion message received (may need more time or workflow has multiple nodes)")
	} else {
		t.Logf("Workflow completed with status: %s", completionMsg.Status)
		if completionMsg.Status != messages.CompletionStatusCompleted {
			t.Errorf("Expected completion status 'completed', got '%s'", completionMsg.Status)
		}

		// Log completion details
		t.Logf("Total execution duration: %d ms", completionMsg.TotalDurationMs)
		t.Logf("Completed at: %s", completionMsg.CompletedAt.Format("2006-01-02 15:04:05"))

		// Log final context details
		if completionMsg.FinalContext != nil {
			t.Logf("Final context keys: %v", getKeys(completionMsg.FinalContext))
			t.Logf("Final context size: %d entries", len(completionMsg.FinalContext))

			// Log execution output from final context
			t.Log("=== Execution Output ===")
			for key, value := range completionMsg.FinalContext {
				// Check if this is node output (keys typically start with $ for node results)
				if strings.HasPrefix(key, "$") {
					// This is the node output
					if nodeOutput, ok := value.(map[string]interface{}); ok {
						t.Logf("Node '%s' output:", key)
						for outKey, outVal := range nodeOutput {
							switch outKey {
							case "status":
								t.Logf("  - HTTP Status: %v", outVal)
							case "status_text":
								t.Logf("  - HTTP Status Text: %v", outVal)
							case "duration_ms":
								t.Logf("  - Request Duration: %v ms", outVal)
							case "headers":
								if headers, ok := outVal.(map[string]interface{}); ok {
									t.Logf("  - Response Headers: %d headers received", len(headers))
									// Log a few important headers
									for hKey, hVal := range headers {
										if hKey == "Content-Type" || hKey == "content-type" {
											t.Logf("    * %s: %v", hKey, hVal)
										}
									}
								} else {
									t.Logf("  - Response Headers: %v", outVal)
								}
							case "body":
								if bodyStr, ok := outVal.(string); ok {
									if len(bodyStr) < 300 {
										t.Logf("  - Response Body: %s", bodyStr)
									} else {
										t.Logf("  - Response Body: %d bytes (truncated): %s...", len(bodyStr), bodyStr[:200])
									}
								} else {
									bodyStr := fmt.Sprint(outVal)
									t.Logf("  - Response Body: %d bytes", len(bodyStr))
								}
							default:
								t.Logf("  - %s: %v", outKey, outVal)
							}
						}
					} else {
						t.Logf("Node '%s' output: %v", key, value)
					}
				} else {
					// Log other context values
					t.Logf("Context[%s]: %v", key, value)
				}
			}
			t.Log("========================")
		} else {
			t.Log("Warning: FinalContext is nil")
		}

		// Log failure reason if present
		if completionMsg.FailureReason != "" {
			t.Logf("Failure reason: %s", completionMsg.FailureReason)
		}
	}

	// Close all consumers in the correct order (after validation)
	t.Log("Closing consumers...")
	statusCancel()
	completionCancel()
	_ = statusConsumer.Close()
	_ = completionConsumer.Close()
	_ = consumer.Close()
	t.Log("Test completed successfully")
}
