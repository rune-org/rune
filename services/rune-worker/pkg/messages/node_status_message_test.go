package messages

import (
	"testing"
	"time"
)

func makeValidStatusMessage() NodeStatusMessage {
	return NodeStatusMessage{
		WorkflowID:  "wf-1",
		ExecutionID: "exec-1",
		NodeID:      "node-1",
		NodeName:    "Node 1",
		Status:      StatusRunning,
		ExecutedAt:  time.Now().UTC(),
		DurationMs:  0,
	}
}

func TestNodeStatusMessageValidate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		mutate  func(*NodeStatusMessage)
		wantErr bool
	}{
		{
			name: "running is valid",
		},
		{
			name: "success is valid",
			mutate: func(m *NodeStatusMessage) {
				m.Status = StatusSuccess
				m.Output = map[string]any{"ok": true}
			},
		},
		{
			name: "waiting is valid",
			mutate: func(m *NodeStatusMessage) {
				m.Status = StatusWaiting
			},
		},
		{
			name: "failed requires error",
			mutate: func(m *NodeStatusMessage) {
				m.Status = StatusFailed
			},
			wantErr: true,
		},
		{
			name: "failed with error is valid",
			mutate: func(m *NodeStatusMessage) {
				m.Status = StatusFailed
				m.Error = &NodeError{
					Message: "boom",
					Code:    "FAILED",
				}
			},
		},
		{
			name: "invalid status value",
			mutate: func(m *NodeStatusMessage) {
				m.Status = "unknown"
			},
			wantErr: true,
		},
		{
			name: "missing node id",
			mutate: func(m *NodeStatusMessage) {
				m.NodeID = ""
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			msg := makeValidStatusMessage()
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

func TestNodeStatusMessageEncodeDecodeRoundTrip(t *testing.T) {
	t.Parallel()

	msg := &NodeStatusMessage{
		WorkflowID:  "wf-1",
		ExecutionID: "exec-1",
		NodeID:      "node-1",
		NodeName:    "Node 1",
		Status:      StatusSuccess,
		Parameters: map[string]any{
			"method": "GET",
		},
		Output: map[string]any{
			"status": 200,
		},
		ExecutedAt: time.Now().UTC(),
		DurationMs: 45,
	}

	payload, err := msg.Encode()
	if err != nil {
		t.Fatalf("encode failed: %v", err)
	}

	decoded, err := DecodeNodeStatusMessage(payload)
	if err != nil {
		t.Fatalf("decode failed: %v", err)
	}

	if decoded.WorkflowID != msg.WorkflowID {
		t.Fatalf("workflow id mismatch: got %s want %s", decoded.WorkflowID, msg.WorkflowID)
	}
	if decoded.Status != msg.Status {
		t.Fatalf("status mismatch: got %s want %s", decoded.Status, msg.Status)
	}
	if decoded.DurationMs != msg.DurationMs {
		t.Fatalf("duration mismatch: got %d want %d", decoded.DurationMs, msg.DurationMs)
	}
}

func TestNodeStatusMessageHelpersAndConstructors(t *testing.T) {
	t.Parallel()

	running := NewRunningStatus("wf", "exec", "n1", "N1")
	if !running.IsRunning() {
		t.Fatalf("expected running status")
	}

	success := NewSuccessStatus("wf", "exec", "n1", "N1", map[string]any{"ok": true}, 10)
	if !success.IsSuccess() {
		t.Fatalf("expected success status")
	}

	failed := NewFailedStatus("wf", "exec", "n1", "N1", &NodeError{Message: "err", Code: "E"}, 5)
	if !failed.IsFailed() {
		t.Fatalf("expected failed status")
	}
}
