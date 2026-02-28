package messages

import (
	"testing"
	"time"
)

func makeValidCompletionMessage() CompletionMessage {
	return CompletionMessage{
		WorkflowID:      "wf-1",
		ExecutionID:     "exec-1",
		Status:          CompletionStatusCompleted,
		FinalContext:    map[string]any{"$node": map[string]any{"ok": true}},
		CompletedAt:     time.Now().UTC(),
		TotalDurationMs: 123,
	}
}

func TestCompletionMessageValidate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		mutate  func(*CompletionMessage)
		wantErr bool
	}{
		{
			name: "completed is valid",
		},
		{
			name: "failed is valid",
			mutate: func(m *CompletionMessage) {
				m.Status = CompletionStatusFailed
				m.FailureReason = "node failed"
			},
		},
		{
			name: "halted is valid",
			mutate: func(m *CompletionMessage) {
				m.Status = CompletionStatusHalted
				m.FailureReason = "halt strategy"
			},
		},
		{
			name: "invalid status",
			mutate: func(m *CompletionMessage) {
				m.Status = "unknown"
			},
			wantErr: true,
		},
		{
			name: "missing final context",
			mutate: func(m *CompletionMessage) {
				m.FinalContext = nil
			},
			wantErr: true,
		},
		{
			name: "missing workflow id",
			mutate: func(m *CompletionMessage) {
				m.WorkflowID = ""
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			msg := makeValidCompletionMessage()
			if tt.mutate != nil {
				tt.mutate(&msg)
			}

			err := msg.Validate()
			if tt.wantErr && err == nil {
				t.Fatalf("expected error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
		})
	}
}

func TestCompletionMessageEncodeDecodeRoundTrip(t *testing.T) {
	t.Parallel()

	msg := &CompletionMessage{
		WorkflowID:      "wf-1",
		ExecutionID:     "exec-1",
		Status:          CompletionStatusCompleted,
		FinalContext:    map[string]any{"$result": "ok"},
		CompletedAt:     time.Now().UTC(),
		TotalDurationMs: 555,
	}

	payload, err := msg.Encode()
	if err != nil {
		t.Fatalf("encode failed: %v", err)
	}

	decoded, err := DecodeCompletionMessage(payload)
	if err != nil {
		t.Fatalf("decode failed: %v", err)
	}

	if decoded.Status != CompletionStatusCompleted {
		t.Fatalf("unexpected status: %s", decoded.Status)
	}
	if decoded.TotalDurationMs != 555 {
		t.Fatalf("unexpected duration: %d", decoded.TotalDurationMs)
	}
}

func TestCompletionMessageConstructorsAndHelpers(t *testing.T) {
	t.Parallel()

	completed := NewCompletedMessage("wf", "exec", map[string]any{"ok": true}, 10)
	if !completed.IsCompleted() {
		t.Fatalf("expected completed message")
	}

	failed := NewFailedMessage("wf", "exec", map[string]any{}, 20, "boom")
	if !failed.IsFailed() {
		t.Fatalf("expected failed message")
	}

	halted := NewHaltedMessage("wf", "exec", map[string]any{}, 30, "halt")
	if !halted.IsHalted() {
		t.Fatalf("expected halted message")
	}
}
