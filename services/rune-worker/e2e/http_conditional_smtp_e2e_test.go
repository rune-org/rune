//go:build integration
// +build integration

package e2e

import (
	"context"
	"fmt"
	"os"
	"strconv"
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

// loadSMTPConfigFromEnv loads SMTP configuration from .env file
func loadSMTPConfigFromEnv(envPath string) (map[string]string, error) {
	// Load .env file if it exists
	if envPath != "" {
		if err := loadTestEnvFile(envPath); err != nil && !os.IsNotExist(err) {
			return nil, fmt.Errorf("failed to load .env file: %w", err)
		}
	}

	// Read SMTP configuration from environment variables
	smtpConfig := map[string]string{
		"host":     os.Getenv("SMTP_HOST"),
		"port":     os.Getenv("SMTP_PORT"),
		"username": os.Getenv("SMTP_USERNAME"),
		"password": os.Getenv("SMTP_PASSWORD"),
	}

	// Set defaults if not specified
	if smtpConfig["port"] == "" {
		smtpConfig["port"] = "587" // Default SMTP submission port
	}

	return smtpConfig, nil
}

// loadTestEnvFile loads environment variables from a .env file
func loadTestEnvFile(path string) error {
	if path == "" {
		return nil
	}

	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	var lines []string
	buf := make([]byte, 1024)
	for {
		n, err := file.Read(buf)
		if n > 0 {
			content := string(buf[:n])
			lines = append(lines, strings.Split(content, "\n")...)
		}
		if err != nil {
			break
		}
	}

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		value = strings.Trim(value, "\"'")

		os.Setenv(key, value)
	}

	return nil
}

// TestHTTPConditionalSMTPWorkflow tests a comprehensive workflow that:
// 1. Makes an HTTP GET request to httpbin.org/uuid to get a UUID
// 2. Uses a conditional node to check if the response contains "uuid" field
// 3. If true, sends a success email via SMTP
// 4. If false, sends a failure email via SMTP
//
// This test validates:
// - HTTP node execution and response parsing
// - Conditional node expression evaluation using context variables
// - SMTP node email sending with credentials from .env file
// - Complete workflow with multiple node types and branching logic
func TestHTTPConditionalSMTPWorkflow(t *testing.T) {
	env := testutils.SetupTestEnv(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithTimeout(context.Background(), testutils.TestTimeout)
	defer cancel()

	// Load SMTP configuration from .env file
	envPath := "../.env.test" // Path from e2e/ to rune-worker/.env.test
	smtpConfig, err := loadSMTPConfigFromEnv(envPath)
	if err != nil {
		t.Fatalf("Failed to load SMTP config: %v", err)
	}

	// Validate SMTP configuration is present
	if smtpConfig["host"] == "" {
		t.Skip("SMTP_HOST not set in environment, skipping SMTP test")
	}
	if smtpConfig["username"] == "" {
		t.Skip("SMTP_USERNAME not set in environment, skipping SMTP test")
	}
	if smtpConfig["password"] == "" {
		t.Skip("SMTP_PASSWORD not set in environment, skipping SMTP test")
	}

	t.Logf("Using SMTP config: host=%s, port=%s, username=%s",
		smtpConfig["host"], smtpConfig["port"], smtpConfig["username"])

	// Define workflow IDs and node IDs
	workflowID := "test-workflow-http-conditional-smtp"
	executionID := "exec-http-conditional-smtp-001"
	httpNodeID := "http-fetch-uuid"
	httpNodeName := "FetchUUID"
	conditionalNodeID := "check-http-success"
	conditionalNodeName := "CheckHTTPSuccess"
	smtpSuccessNodeID := "smtp-success-email"
	smtpSuccessNodeName := "SendSuccessEmail"
	smtpFailureNodeID := "smtp-failure-email"
	smtpFailureNodeName := "SendFailureEmail"

	// Define edge IDs
	httpToConditionalEdge := "edge-http-to-conditional"
	conditionalTrueEdge := "edge-conditional-true"
	conditionalFalseEdge := "edge-conditional-false"

	// Get email addresses from env or use defaults
	fromEmail := os.Getenv("SMTP_FROM_EMAIL")
	if fromEmail == "" {
		fromEmail = smtpConfig["username"] // Use SMTP username as from address
	}
	toEmail := os.Getenv("SMTP_TO_EMAIL")
	if toEmail == "" {
		toEmail = smtpConfig["username"] // Send to self for testing
	}

	t.Logf("Email addresses: from=%s, to=%s", fromEmail, toEmail)

	// Create workflow definition
	executionMsg := &messages.NodeExecutionMessage{
		WorkflowID:  workflowID,
		ExecutionID: executionID,
		CurrentNode: httpNodeID,
		WorkflowDefinition: core.Workflow{
			WorkflowID:  workflowID,
			ExecutionID: executionID,
			Nodes: []core.Node{
				{
					ID:   httpNodeID,
					Name: httpNodeName,
					Type: "http",
					Parameters: map[string]interface{}{
						"method": "GET",
						"url":    "https://httpbin.org/uuid",
					},
				},
				{
					ID:   conditionalNodeID,
					Name: conditionalNodeName,
					Type: "conditional",
					Parameters: map[string]interface{}{
						// Check if HTTP request was successful (status 200)
						// Note: Context uses node names, not IDs
						"expression":    "$" + httpNodeName + ".status == 200",
						"true_edge_id":  conditionalTrueEdge,
						"false_edge_id": conditionalFalseEdge,
					},
				},
				{
					ID:   smtpSuccessNodeID,
					Name: smtpSuccessNodeName,
					Type: "smtp",
					Parameters: map[string]interface{}{
						"from":    fromEmail,
						"to":      toEmail,
						"subject": "Workflow Success - UUID Fetched",
						"body":    "The workflow successfully fetched a UUID from httpbin.org!\n\nHTTP Status: {{ $" + httpNodeName + ".status }}",
					},
					Credentials: &core.Credential{
						ID:   "smtp-test-cred-success",
						Name: "Test SMTP Credentials",
						Type: "smtp",
						Values: map[string]any{
							"host":     smtpConfig["host"],
							"port":     smtpConfig["port"],
							"username": smtpConfig["username"],
							"password": smtpConfig["password"],
						},
					},
				},
				{
					ID:   smtpFailureNodeID,
					Name: smtpFailureNodeName,
					Type: "smtp",
					Parameters: map[string]interface{}{
						"from":    fromEmail,
						"to":      toEmail,
						"subject": "Workflow Failure - HTTP Request Failed",
						"body":    "The workflow failed to fetch UUID from httpbin.org.\n\nPlease check the HTTP endpoint.",
					},
					Credentials: &core.Credential{
						ID:   "smtp-test-cred-failure",
						Name: "Test SMTP Credentials",
						Type: "smtp",
						Values: map[string]any{
							"host":     smtpConfig["host"],
							"port":     smtpConfig["port"],
							"username": smtpConfig["username"],
							"password": smtpConfig["password"],
						},
					},
				},
			},
			Edges: []core.Edge{
				{
					ID:  httpToConditionalEdge,
					Src: httpNodeID,
					Dst: conditionalNodeID,
				},
				{
					ID:  conditionalTrueEdge,
					Src: conditionalNodeID,
					Dst: smtpSuccessNodeID,
				},
				{
					ID:  conditionalFalseEdge,
					Src: conditionalNodeID,
					Dst: smtpFailureNodeID,
				},
			},
		},
		AccumulatedContext: make(map[string]interface{}),
	}

	// Encode and publish the execution message
	msgBytes, err := executionMsg.Encode()
	if err != nil {
		t.Fatalf("Failed to encode execution message: %v", err)
	}

	t.Log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	t.Log("📤 Publishing workflow execution message")
	t.Log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	err = env.Publisher.Publish(ctx, "workflow.execution", msgBytes)
	if err != nil {
		t.Fatalf("Failed to publish execution message: %v", err)
	}
	t.Log("✅ Successfully published NodeExecutionMessage")

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
	statusCtx, statusCancel := context.WithTimeout(ctx, 20*time.Second)
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
				logStatusMessage(t, msg, len(statusMsgs), "HTTP→CONDITIONAL→SMTP")
			}
			return nil
		})
		close(statusDone)
	}()

	// Consume completion message
	completionCtx, completionCancel := context.WithTimeout(ctx, 20*time.Second)
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
				logCompletionMessage(t, msg, "HTTP→CONDITIONAL→SMTP")
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
	consumerCtx, consumerCancel := context.WithTimeout(ctx, 18*time.Second)
	defer consumerCancel()

	t.Log("🚀 Starting workflow consumer to process the workflow")
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
	t.Log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	t.Log("📊 VALIDATING EXECUTION RESULTS")
	t.Log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	if len(statusMsgs) == 0 {
		t.Fatal("Expected at least one status message, got none")
	}

	t.Logf("📨 Received %d status message(s)", len(statusMsgs))

	// Track which nodes were executed
	executedHTTP := false
	executedConditional := false
	executedSMTPSuccess := false
	executedSMTPFailure := false
	var httpStatus int
	var conditionalResult bool

	for _, msg := range statusMsgs {
		if msg.Status == messages.StatusSuccess {
			t.Logf("✅ Node executed successfully: %s (%s)", msg.NodeID, msg.NodeName)

			switch msg.NodeID {
			case httpNodeID:
				executedHTTP = true
				// Extract HTTP status from output
				if msg.Output != nil {
					if status, ok := msg.Output["status"].(float64); ok {
						httpStatus = int(status)
						t.Logf("   HTTP Status: %d", httpStatus)
					} else if status, ok := msg.Output["status"].(int); ok {
						httpStatus = status
						t.Logf("   HTTP Status: %d", httpStatus)
					}
					if body, ok := msg.Output["body"].(string); ok {
						t.Logf("   Response Body: %s", truncateString(body, 100))
					}
				}

			case conditionalNodeID:
				executedConditional = true
				// Extract conditional result
				if msg.Output != nil {
					if result, ok := msg.Output["result"].(bool); ok {
						conditionalResult = result
						t.Logf("   Conditional Result: %v", result)
					}
					if expr, ok := msg.Output["expression"].(string); ok {
						t.Logf("   Evaluated Expression: %s", expr)
					}
				}

			case smtpSuccessNodeID:
				executedSMTPSuccess = true
				t.Log("   📧 Success email sent!")
				if msg.Output != nil {
					if recipients, ok := msg.Output["recipients"].(float64); ok {
						t.Logf("   Recipients: %.0f", recipients)
					} else if recipients, ok := msg.Output["recipients"].(int); ok {
						t.Logf("   Recipients: %d", recipients)
					}
					if durationMs, ok := msg.Output["duration_ms"].(float64); ok {
						t.Logf("   Email Send Duration: %.0f ms", durationMs)
					} else if durationMs, ok := msg.Output["duration_ms"].(int64); ok {
						t.Logf("   Email Send Duration: %d ms", durationMs)
					}
				}

			case smtpFailureNodeID:
				executedSMTPFailure = true
				t.Log("   📧 Failure email sent!")
				if msg.Output != nil {
					if recipients, ok := msg.Output["recipients"].(float64); ok {
						t.Logf("   Recipients: %.0f", recipients)
					} else if recipients, ok := msg.Output["recipients"].(int); ok {
						t.Logf("   Recipients: %d", recipients)
					}
				}
			}
		} else if msg.Status == messages.StatusFailed {
			t.Logf("❌ Node failed: %s (%s)", msg.NodeID, msg.NodeName)
			if msg.Error != nil {
				t.Logf("   Error: %s (code: %s)", msg.Error.Message, msg.Error.Code)
			}
		}
	}

	// Assertions
	if !executedHTTP {
		t.Error("❌ Expected HTTP node to be executed")
	}
	if !executedConditional {
		t.Error("❌ Expected conditional node to be executed")
	}

	// Based on HTTP status, check which SMTP node was executed
	if httpStatus == 200 {
		if !executedSMTPSuccess {
			t.Error("❌ Expected success SMTP node to be executed when HTTP status is 200")
		}
		if executedSMTPFailure {
			t.Error("❌ Should not have executed failure SMTP node when HTTP status is 200")
		}
		if !conditionalResult {
			t.Error("❌ Expected conditional result to be true when HTTP status is 200")
		}
	} else {
		if executedSMTPSuccess {
			t.Error("❌ Should not have executed success SMTP node when HTTP status is not 200")
		}
		if !executedSMTPFailure {
			t.Error("❌ Expected failure SMTP node to be executed when HTTP status is not 200")
		}
		if conditionalResult {
			t.Error("❌ Expected conditional result to be false when HTTP status is not 200")
		}
	}

	// Validate completion
	if completionMsg == nil {
		t.Error("❌ Expected completion message")
	} else {
		t.Log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		t.Logf("✅ Workflow completed with status: %s", completionMsg.Status)
		t.Logf("⏱️  Total execution duration: %d ms", completionMsg.TotalDurationMs)
		t.Log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

		if completionMsg.Status != messages.CompletionStatusCompleted {
			t.Errorf("❌ Expected completion status 'completed', got '%s'", completionMsg.Status)
			if completionMsg.FailureReason != "" {
				t.Logf("Failure reason: %s", completionMsg.FailureReason)
			}
		}

		// Log final context
		if completionMsg.FinalContext != nil {
			t.Logf("📦 Final context contains %d entries", len(completionMsg.FinalContext))
			for key := range completionMsg.FinalContext {
				if strings.HasPrefix(key, "$") {
					t.Logf("   - %s", key)
				}
			}
		}
	}

	// Close all consumers
	t.Log("🔄 Closing consumers...")
	statusCancel()
	completionCancel()
	_ = statusConsumer.Close()
	_ = completionConsumer.Close()
	_ = consumer.Close()
	t.Log("✅ Test completed successfully")
}

// truncateString truncates a string to maxLen characters
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// parseInt safely converts a string to an integer
func parseInt(s string) (int, error) {
	return strconv.Atoi(s)
}
