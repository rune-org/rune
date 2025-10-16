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
)

// logStatusMessage logs a status message with enhanced formatting
func logStatusMessage(t *testing.T, msg *messages.NodeStatusMessage, msgNum int, testPath string) {
	t.Logf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	t.Logf("📨 STATUS MESSAGE #%d (%s)", msgNum, testPath)
	t.Logf("  Node ID:   %s", msg.NodeID)
	t.Logf("  Node Name: %s", msg.NodeName)
	t.Logf("  Status:    %s", msg.Status)
	if msg.Output != nil && len(msg.Output) > 0 {
		t.Logf("  Output:")
		for k, v := range msg.Output {
			switch val := v.(type) {
			case string:
				if len(val) > 200 {
					t.Logf("    %s: %s... (truncated, length=%d)", k, val[:200], len(val))
				} else {
					t.Logf("    %s: %s", k, val)
				}
			default:
				t.Logf("    %s: %+v", k, v)
			}
		}
	}
	if msg.Error != nil {
		t.Logf("  Error:     %s (code: %s)", msg.Error.Message, msg.Error.Code)
		if msg.Error.Details != nil && len(msg.Error.Details) > 0 {
			t.Logf("  Error Details: %+v", msg.Error.Details)
		}
	}
	t.Logf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
}

// logCompletionMessage logs a completion message with enhanced formatting
func logCompletionMessage(t *testing.T, msg *messages.CompletionMessage, testPath string) {
	t.Logf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	t.Logf("✅ COMPLETION MESSAGE (%s)", testPath)
	t.Logf("  Status:         %s", msg.Status)
	if msg.FailureReason != "" {
		t.Logf("  Failure Reason: %s", msg.FailureReason)
	}
	t.Logf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
}

// TestConditionalNodeTruePath tests a workflow with a conditional node that evaluates to true.
// If the condition is true, it should fetch google.com, otherwise yahoo.com.
// This test validates:
// 1. ConditionalNode evaluates expressions correctly
// 2. Executor follows the correct edge based on the result
// 3. The correct HTTP node is executed based on the condition
func TestConditionalNodeTruePath(t *testing.T) {
	env := setupE2ETest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	workflowID := "test-workflow-conditional-true"
	executionID := "exec-conditional-true-001"
	conditionalNodeID := "conditional-node-1"
	trueNodeID := "http-node-google"
	falseNodeID := "http-node-yahoo"

	// Define edges
	trueEdgeID := "edge-true"
	falseEdgeID := "edge-false"

	executionMsg := &messages.NodeExecutionMessage{
		WorkflowID:  workflowID,
		ExecutionID: executionID,
		CurrentNode: conditionalNodeID,
		WorkflowDefinition: core.Workflow{
			WorkflowID:  workflowID,
			ExecutionID: executionID,
			Nodes: []core.Node{
				{
					ID:   conditionalNodeID,
					Name: "Check Condition",
					Type: "conditional",
					Parameters: map[string]interface{}{
						"expression":    "$useGoogle == true",
						"true_edge_id":  trueEdgeID,
						"false_edge_id": falseEdgeID,
					},
				},
				{
					ID:   trueNodeID,
					Name: "Fetch Google",
					Type: "http",
					Parameters: map[string]interface{}{
						"method": "GET",
						"url":    "https://www.google.com",
					},
				},
				{
					ID:   falseNodeID,
					Name: "Fetch Yahoo",
					Type: "http",
					Parameters: map[string]interface{}{
						"method": "GET",
						"url":    "https://www.yahoo.com",
					},
				},
			},
			Edges: []core.Edge{
				{
					ID:  trueEdgeID,
					Src: conditionalNodeID,
					Dst: trueNodeID,
				},
				{
					ID:  falseEdgeID,
					Src: conditionalNodeID,
					Dst: falseNodeID,
				},
			},
		},
		AccumulatedContext: map[string]interface{}{
			"$useGoogle": true,
			"useGoogle": true,
		},
	}

	// Encode and publish the execution message
	msgBytes, err := executionMsg.Encode()
	if err != nil {
		t.Fatalf("Failed to encode execution message: %v", err)
	}

	t.Log("Publishing NodeExecutionMessage for conditional workflow (true path)")
	err = env.Publisher.Publish(ctx, "workflow.execution", msgBytes)
	if err != nil {
		t.Fatalf("Failed to publish execution message: %v", err)
	}
	t.Log("Successfully published NodeExecutionMessage")

	// Create consumers for status and completion queues
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
	statusCtx, statusCancel := context.WithTimeout(ctx, 15*time.Second)
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
				logStatusMessage(t, msg, len(statusMsgs), "TRUE PATH")
			}
			return nil
		})
		close(statusDone)
	}()

	// Consume completion message
	completionCtx, completionCancel := context.WithTimeout(ctx, 15*time.Second)
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
				logCompletionMessage(t, msg, "TRUE PATH")
				completionCancel()
			}
			return nil
		})
		close(completionDone)
	}()

	// Create main workflow consumer
	cfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		QueueName:   "workflow.execution",
		Prefetch:    1,
		Concurrency: 1,
	}

	consumer, err := messaging.NewWorkflowConsumer(cfg)
	if err != nil {
		t.Fatalf("Failed to create workflow consumer: %v", err)
	}

	// Start main consumer
	consumerCtx, consumerCancel := context.WithTimeout(ctx, 12*time.Second)
	defer consumerCancel()

	t.Log("Starting workflow consumer to process the conditional workflow")
	consumerErr := make(chan error, 1)
	go func() {
		consumerErr <- consumer.Run(consumerCtx)
	}()

	// Wait for consumer to process
	select {
	case err := <-consumerErr:
		if err != nil && err != context.DeadlineExceeded {
			t.Fatalf("Consumer error: %v", err)
		}
	case <-ctx.Done():
		t.Fatal("Test timeout")
	}

	// Give time for status/completion messages to be consumed
	time.Sleep(2 * time.Second)

	// Validate results
	t.Log("Validating execution results...")

	if len(statusMsgs) == 0 {
		t.Fatal("Expected at least one status message, got none")
	}

	t.Logf("Received %d status message(s)", len(statusMsgs))

	// Verify we executed the conditional node and the Google node (true path)
	executedConditional := false
	executedGoogle := false
	executedYahoo := false

	for _, msg := range statusMsgs {
		if msg.Status == messages.StatusSuccess {
			t.Logf("Node executed successfully: %s (%s)", msg.NodeID, msg.NodeName)

			if msg.NodeID == conditionalNodeID {
				executedConditional = true
				// Verify the conditional node output
				if msg.Output != nil {
					if result, ok := msg.Output["result"].(bool); ok {
						if !result {
							t.Errorf("Expected conditional result to be true, got false")
						}
						t.Logf("  - Conditional result: %v", result)
					} else {
						t.Error("Expected conditional node to have boolean result field")
					}
					if expr, ok := msg.Output["expression"].(string); ok {
						t.Logf("  - Evaluated expression: %s", expr)
					}
				}
			}

			if msg.NodeID == trueNodeID {
				executedGoogle = true
				// Verify we got a response from Google
				if msg.Output != nil {
					if body, ok := msg.Output["body"].(string); ok {
						if !strings.Contains(strings.ToLower(body), "google") {
							t.Logf("Warning: Response body doesn't contain 'google': %s", body[:min(200, len(body))])
						} else {
							t.Log("  - Successfully fetched Google.com")
						}
					}
				}
			}

			if msg.NodeID == falseNodeID {
				executedYahoo = true
				t.Error("Should not have executed Yahoo node when condition is true")
			}
		}
	}

	if !executedConditional {
		t.Error("Expected conditional node to be executed")
	}

	if !executedGoogle {
		t.Error("Expected Google node to be executed (true path)")
	}

	if executedYahoo {
		t.Error("Should not have executed Yahoo node (false path)")
	}

	if completionMsg == nil {
		t.Error("Expected completion message")
	} else {
		t.Logf("Workflow completed with status: %s", completionMsg.Status)
		if completionMsg.Status != messages.CompletionStatusCompleted {
			t.Errorf("Expected completion status 'completed', got '%s'", completionMsg.Status)
			if completionMsg.FailureReason != "" {
				t.Logf("Failure reason: %s", completionMsg.FailureReason)
			}
		}
	}

	// Close all consumers
	t.Log("Closing consumers...")
	statusCancel()
	completionCancel()
	_ = statusConsumer.Close()
	_ = completionConsumer.Close()
	_ = consumer.Close()
	t.Log("Test completed successfully")
}

// TestConditionalNodeFalsePath tests a workflow with a conditional node that evaluates to false.
// If the condition is false, it should fetch yahoo.com instead of google.com.
func TestConditionalNodeFalsePath(t *testing.T) {
	env := setupE2ETest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	workflowID := "test-workflow-conditional-false"
	executionID := "exec-conditional-false-001"
	conditionalNodeID := "conditional-node-1"
	trueNodeID := "http-node-google"
	falseNodeID := "http-node-yahoo"

	// Define edges
	trueEdgeID := "edge-true"
	falseEdgeID := "edge-false"

	executionMsg := &messages.NodeExecutionMessage{
		WorkflowID:  workflowID,
		ExecutionID: executionID,
		CurrentNode: conditionalNodeID,
		WorkflowDefinition: core.Workflow{
			WorkflowID:  workflowID,
			ExecutionID: executionID,
			Nodes: []core.Node{
				{
					ID:   conditionalNodeID,
					Name: "Check Condition",
					Type: "conditional",
					Parameters: map[string]interface{}{
						"expression":    "$useGoogle == true",
						"true_edge_id":  trueEdgeID,
						"false_edge_id": falseEdgeID,
					},
				},
				{
					ID:   trueNodeID,
					Name: "Fetch Google",
					Type: "http",
					Parameters: map[string]interface{}{
						"method": "GET",
						"url":    "https://www.google.com",
					},
				},
				{
					ID:   falseNodeID,
					Name: "Fetch Yahoo",
					Type: "http",
					Parameters: map[string]interface{}{
						"method": "GET",
						"url":    "https://www.yahoo.com",
					},
				},
			},
			Edges: []core.Edge{
				{
					ID:  trueEdgeID,
					Src: conditionalNodeID,
					Dst: trueNodeID,
				},
				{
					ID:  falseEdgeID,
					Src: conditionalNodeID,
					Dst: falseNodeID,
				},
			},
		},
		AccumulatedContext: map[string]interface{}{
			"$useGoogle": false, // Set to false to test the false path
		},
	}

	// Encode and publish the execution message
	msgBytes, err := executionMsg.Encode()
	if err != nil {
		t.Fatalf("Failed to encode execution message: %v", err)
	}

	t.Log("Publishing NodeExecutionMessage for conditional workflow (false path)")
	err = env.Publisher.Publish(ctx, "workflow.execution", msgBytes)
	if err != nil {
		t.Fatalf("Failed to publish execution message: %v", err)
	}
	t.Log("Successfully published NodeExecutionMessage")

	// Create consumers for status and completion queues
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
	statusCtx, statusCancel := context.WithTimeout(ctx, 15*time.Second)
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
				logStatusMessage(t, msg, len(statusMsgs), "FALSE PATH")
			}
			return nil
		})
		close(statusDone)
	}()

	// Consume completion message
	completionCtx, completionCancel := context.WithTimeout(ctx, 15*time.Second)
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
				logCompletionMessage(t, msg, "FALSE PATH")
				completionCancel()
			}
			return nil
		})
		close(completionDone)
	}()

	// Create main workflow consumer
	cfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		QueueName:   "workflow.execution",
		Prefetch:    1,
		Concurrency: 1,
	}

	consumer, err := messaging.NewWorkflowConsumer(cfg)
	if err != nil {
		t.Fatalf("Failed to create workflow consumer: %v", err)
	}

	// Start main consumer
	consumerCtx, consumerCancel := context.WithTimeout(ctx, 12*time.Second)
	defer consumerCancel()

	t.Log("Starting workflow consumer to process the conditional workflow")
	consumerErr := make(chan error, 1)
	go func() {
		consumerErr <- consumer.Run(consumerCtx)
	}()

	// Wait for consumer to process
	select {
	case err := <-consumerErr:
		if err != nil && err != context.DeadlineExceeded {
			t.Fatalf("Consumer error: %v", err)
		}
	case <-ctx.Done():
		t.Fatal("Test timeout")
	}

	// Give time for status/completion messages to be consumed
	time.Sleep(2 * time.Second)

	// Validate results
	t.Log("Validating execution results...")

	if len(statusMsgs) == 0 {
		t.Fatal("Expected at least one status message, got none")
	}

	t.Logf("Received %d status message(s)", len(statusMsgs))

	// Verify we executed the conditional node and the Yahoo node (false path)
	executedConditional := false
	executedGoogle := false
	executedYahoo := false

	for _, msg := range statusMsgs {
		if msg.Status == messages.StatusSuccess {
			t.Logf("Node executed successfully: %s (%s)", msg.NodeID, msg.NodeName)

			if msg.NodeID == conditionalNodeID {
				executedConditional = true
				// Verify the conditional node output
				if msg.Output != nil {
					if result, ok := msg.Output["result"].(bool); ok {
						if result {
							t.Errorf("Expected conditional result to be false, got true")
						}
						t.Logf("  - Conditional result: %v", result)
					} else {
						t.Error("Expected conditional node to have boolean result field")
					}
					if expr, ok := msg.Output["expression"].(string); ok {
						t.Logf("  - Evaluated expression: %s", expr)
					}
				}
			}

			if msg.NodeID == trueNodeID {
				executedGoogle = true
				t.Error("Should not have executed Google node when condition is false")
			}

			if msg.NodeID == falseNodeID {
				executedYahoo = true
				// Verify we got a response from Yahoo
				if msg.Output != nil {
					if body, ok := msg.Output["body"].(string); ok {
						if !strings.Contains(strings.ToLower(body), "yahoo") {
							t.Logf("Warning: Response body doesn't contain 'yahoo': %s", body[:min(200, len(body))])
						} else {
							t.Log("  - Successfully fetched Yahoo.com")
						}
					}
				}
			}
		}
	}

	if !executedConditional {
		t.Error("Expected conditional node to be executed")
	}

	if executedGoogle {
		t.Error("Should not have executed Google node (true path)")
	}

	if !executedYahoo {
		t.Error("Expected Yahoo node to be executed (false path)")
	}

	if completionMsg == nil {
		t.Error("Expected completion message")
	} else {
		t.Logf("Workflow completed with status: %s", completionMsg.Status)
		if completionMsg.Status != messages.CompletionStatusCompleted {
			t.Errorf("Expected completion status 'completed', got '%s'", completionMsg.Status)
			if completionMsg.FailureReason != "" {
				t.Logf("Failure reason: %s", completionMsg.FailureReason)
			}
		}
	}

	// Close all consumers
	t.Log("Closing consumers...")
	statusCancel()
	completionCancel()
	_ = statusConsumer.Close()
	_ = completionConsumer.Close()
	_ = consumer.Close()
	t.Log("Test completed successfully")
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
