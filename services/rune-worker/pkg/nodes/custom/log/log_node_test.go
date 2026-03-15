package lognode

import (
	"context"
	"testing"
	"time"

	"rune-worker/plugin"
)

func TestLogNodeExecute(t *testing.T) {
	tests := []struct {
		name       string
		parameters map[string]any
		wantMsg    string
		wantLevel  string
	}{
		{
			name:       "explicit warning message",
			parameters: map[string]any{"message": "invoice sync completed", "level": "warn"},
			wantMsg:    "invoice sync completed",
			wantLevel:  "warn",
		},
		{
			name:       "defaults invalid level to info",
			parameters: map[string]any{"message": "customer created", "level": "unexpected"},
			wantMsg:    "customer created",
			wantLevel:  "info",
		},
		{
			name:       "normalizes uppercase level",
			parameters: map[string]any{"message": "retry attempt", "level": "ERROR"},
			wantMsg:    "retry attempt",
			wantLevel:  "error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node := NewLogNode(plugin.ExecutionContext{Parameters: tt.parameters, NodeID: "log1"})
			output, err := node.Execute(context.Background(), plugin.ExecutionContext{WorkflowID: "wf1", ExecutionID: "exec1"})
			if err != nil {
				t.Fatalf("execute error: %v", err)
			}
			if output["message"] != tt.wantMsg {
				t.Fatalf("unexpected message: %v", output["message"])
			}
			if output["level"] != tt.wantLevel {
				t.Fatalf("unexpected level: %v", output["level"])
			}
			loggedAt, ok := output["logged_at"].(string)
			if !ok || loggedAt == "" {
				t.Fatalf("missing logged_at: %#v", output["logged_at"])
			}
			if _, err := time.Parse(time.RFC3339, loggedAt); err != nil {
				t.Fatalf("logged_at is not RFC3339: %v", err)
			}
		})
	}
}

func TestLogNodeRequiresMessage(t *testing.T) {
	tests := []map[string]any{
		{"level": "info"},
		{"message": ""},
		{"message": "   "},
	}

	for _, params := range tests {
		node := NewLogNode(plugin.ExecutionContext{Parameters: params})
		if _, err := node.Execute(context.Background(), plugin.ExecutionContext{}); err == nil {
			t.Fatalf("expected error for params %#v", params)
		}
	}
}
