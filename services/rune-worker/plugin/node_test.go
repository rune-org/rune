package plugin

import (
	"testing"
)

func TestExecutionContextGetCredentials(t *testing.T) {
	tests := []struct {
		name        string
		credentials map[string]any
		wantLen     int
	}{
		{
			name: "with credentials",
			credentials: map[string]any{
				"username": "testuser",
				"password": "testpass",
			},
			wantLen: 2,
		},
		{
			name:        "empty credentials",
			credentials: map[string]any{},
			wantLen:     0,
		},
		{
			name:        "nil credentials",
			credentials: nil,
			wantLen:     0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := &ExecutionContext{
				credentials: tt.credentials,
			}

			creds := ctx.GetCredentials()
			if creds == nil {
				t.Fatal("GetCredentials() returned nil")
			}
			if len(creds) != tt.wantLen {
				t.Errorf("GetCredentials() returned %d items, want %d", len(creds), tt.wantLen)
			}

			// Verify it's a copy (modifying returned map shouldn't affect original)
			if tt.wantLen > 0 {
				creds["new_key"] = "new_value"
				credsCopy := ctx.GetCredentials()
				if _, exists := credsCopy["new_key"]; exists {
					t.Error("Modification to returned credentials affected original")
				}
			}
		})
	}
}

func TestExecutionContextGetCredentialsReturnsEmptyMap(t *testing.T) {
	ctx := &ExecutionContext{}
	creds := ctx.GetCredentials()

	if creds == nil {
		t.Error("GetCredentials() should return empty map, not nil")
	}
	if len(creds) != 0 {
		t.Errorf("GetCredentials() returned %d items, want 0", len(creds))
	}
}

func TestExecutionContextSetCredentials(t *testing.T) {
	ctx := &ExecutionContext{}

	testCreds := map[string]any{
		"api_key": "secret123",
		"token":   "abc789",
	}

	ctx.SetCredentials(testCreds)

	// Verify credentials were set
	creds := ctx.GetCredentials()
	if len(creds) != 2 {
		t.Errorf("GetCredentials() returned %d items, want 2", len(creds))
	}
	if creds["api_key"] != "secret123" {
		t.Errorf("api_key = %v, want secret123", creds["api_key"])
	}
	if creds["token"] != "abc789" {
		t.Errorf("token = %v, want abc789", creds["token"])
	}
}

func TestExecutionContextSetCredentialsNil(t *testing.T) {
	ctx := &ExecutionContext{
		credentials: map[string]any{"old": "value"},
	}

	ctx.SetCredentials(nil)

	// GetCredentials should still return empty map, not nil
	creds := ctx.GetCredentials()
	if creds == nil {
		t.Error("GetCredentials() should return empty map after setting nil credentials")
	}
	if len(creds) != 0 {
		t.Errorf("GetCredentials() returned %d items after setting nil, want 0", len(creds))
	}
}

func TestExecutionContextFields(t *testing.T) {
	ctx := &ExecutionContext{
		ExecutionID: "exec-123",
		WorkflowID:  "wf-456",
		NodeID:      "node-789",
		Type:        "http",
		Parameters: map[string]any{
			"url": "https://example.com",
		},
		Input: map[string]any{
			"data": "test",
		},
	}

	if ctx.ExecutionID != "exec-123" {
		t.Errorf("ExecutionID = %v, want exec-123", ctx.ExecutionID)
	}
	if ctx.WorkflowID != "wf-456" {
		t.Errorf("WorkflowID = %v, want wf-456", ctx.WorkflowID)
	}
	if ctx.NodeID != "node-789" {
		t.Errorf("NodeID = %v, want node-789", ctx.NodeID)
	}
	if ctx.Type != "http" {
		t.Errorf("Type = %v, want http", ctx.Type)
	}
	if len(ctx.Parameters) != 1 {
		t.Errorf("Parameters has %d items, want 1", len(ctx.Parameters))
	}
	if len(ctx.Input) != 1 {
		t.Errorf("Input has %d items, want 1", len(ctx.Input))
	}
}

func TestExecutionContextCredentialsIsolation(t *testing.T) {
	// Test that credentials are properly isolated between contexts
	ctx1 := &ExecutionContext{}
	ctx2 := &ExecutionContext{}

	ctx1.SetCredentials(map[string]any{"key1": "value1"})
	ctx2.SetCredentials(map[string]any{"key2": "value2"})

	creds1 := ctx1.GetCredentials()
	creds2 := ctx2.GetCredentials()

	if _, exists := creds1["key2"]; exists {
		t.Error("ctx1 should not have key2 from ctx2")
	}
	if _, exists := creds2["key1"]; exists {
		t.Error("ctx2 should not have key1 from ctx1")
	}
}

func TestExecutionContextModificationIsolation(t *testing.T) {
	// Test that modifying returned credentials doesn't affect internal state
	originalCreds := map[string]any{
		"username": "user",
		"password": "pass",
	}

	ctx := &ExecutionContext{}
	ctx.SetCredentials(originalCreds)

	// Get credentials and modify
	creds := ctx.GetCredentials()
	creds["username"] = "modified"
	creds["new_field"] = "new_value"

	// Get credentials again and verify original values
	freshCreds := ctx.GetCredentials()
	if freshCreds["username"] != "user" {
		t.Errorf("username was modified in internal state: %v", freshCreds["username"])
	}
	if _, exists := freshCreds["new_field"]; exists {
		t.Error("new_field should not exist in internal state")
	}
}
