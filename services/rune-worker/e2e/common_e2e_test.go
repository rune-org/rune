//go:build integration
// +build integration

package e2e

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"testing"

	"rune-worker/pkg/messages"
	testutils "rune-worker/test_utils"
)

const (
	testTimeout = testutils.TestTimeout
)

// setupE2ETest creates a test environment for E2E tests
func setupE2ETest(t *testing.T) *testutils.TestEnv {
	return testutils.SetupTestEnv(t)
}

// getKeys returns the keys from a map for logging purposes
func getKeys(m map[string]interface{}) []string {
	return testutils.GetKeys(m)
}

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

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
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
