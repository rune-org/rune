package messages

import (
	"encoding/json"
	"fmt"
	"time"
)

// CompletionMessage signals workflow execution completion or termination.
// This message is published to the workflow.completion queue when a workflow
// finishes executing (successfully, with failure, or halted).
type CompletionMessage struct {
	WorkflowID      string                 `json:"workflow_id"`
	ExecutionID     string                 `json:"execution_id"`
	Status          string                 `json:"status"` // "completed", "failed", "halted"
	FinalContext    map[string]interface{} `json:"final_context"`
	CompletedAt     time.Time              `json:"completed_at"`
	TotalDurationMs int64                  `json:"total_duration_ms"`
	FailureReason   string                 `json:"failure_reason,omitempty"`
}

// Completion status constants
const (
	CompletionStatusCompleted = "completed"
	CompletionStatusFailed    = "failed"
	CompletionStatusHalted    = "halted"
)

// Validate checks if the CompletionMessage has all required fields.
func (m *CompletionMessage) Validate() error {
	if m.WorkflowID == "" {
		return fmt.Errorf("workflow_id is required")
	}
	if m.ExecutionID == "" {
		return fmt.Errorf("execution_id is required")
	}
	if m.Status == "" {
		return fmt.Errorf("status is required")
	}

	// Validate status value
	switch m.Status {
	case CompletionStatusCompleted, CompletionStatusFailed, CompletionStatusHalted:
		// valid status
	default:
		return fmt.Errorf("invalid status: %s (must be 'completed', 'failed', or 'halted')", m.Status)
	}

	if m.FinalContext == nil {
		return fmt.Errorf("final_context is required")
	}

	return nil
}

// IsCompleted returns true if the workflow completed successfully.
func (m *CompletionMessage) IsCompleted() bool {
	return m.Status == CompletionStatusCompleted
}

// IsFailed returns true if the workflow failed.
func (m *CompletionMessage) IsFailed() bool {
	return m.Status == CompletionStatusFailed
}

// IsHalted returns true if the workflow was halted due to error handling.
func (m *CompletionMessage) IsHalted() bool {
	return m.Status == CompletionStatusHalted
}

// DecodeCompletionMessage parses a message payload into a CompletionMessage.
func DecodeCompletionMessage(payload []byte) (*CompletionMessage, error) {
	var msg CompletionMessage
	if err := json.Unmarshal(payload, &msg); err != nil {
		return nil, fmt.Errorf("decode completion message: %w", err)
	}

	if err := msg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid completion message: %w", err)
	}

	return &msg, nil
}

// Encode serializes the CompletionMessage to JSON bytes.
func (m *CompletionMessage) Encode() ([]byte, error) {
	if err := m.Validate(); err != nil {
		return nil, fmt.Errorf("cannot encode invalid message: %w", err)
	}

	data, err := json.Marshal(m)
	if err != nil {
		return nil, fmt.Errorf("encode completion message: %w", err)
	}
	return data, nil
}

// NewCompletedMessage creates a CompletionMessage with "completed" status.
func NewCompletedMessage(workflowID, executionID string, finalContext map[string]interface{}, totalDurationMs int64) *CompletionMessage {
	return &CompletionMessage{
		WorkflowID:      workflowID,
		ExecutionID:     executionID,
		Status:          CompletionStatusCompleted,
		FinalContext:    finalContext,
		CompletedAt:     time.Now(),
		TotalDurationMs: totalDurationMs,
	}
}

// NewFailedMessage creates a CompletionMessage with "failed" status.
func NewFailedMessage(workflowID, executionID string, finalContext map[string]interface{}, totalDurationMs int64, reason string) *CompletionMessage {
	return &CompletionMessage{
		WorkflowID:      workflowID,
		ExecutionID:     executionID,
		Status:          CompletionStatusFailed,
		FinalContext:    finalContext,
		CompletedAt:     time.Now(),
		TotalDurationMs: totalDurationMs,
		FailureReason:   reason,
	}
}

// NewHaltedMessage creates a CompletionMessage with "halted" status.
func NewHaltedMessage(workflowID, executionID string, finalContext map[string]interface{}, totalDurationMs int64, reason string) *CompletionMessage {
	return &CompletionMessage{
		WorkflowID:      workflowID,
		ExecutionID:     executionID,
		Status:          CompletionStatusHalted,
		FinalContext:    finalContext,
		CompletedAt:     time.Now(),
		TotalDurationMs: totalDurationMs,
		FailureReason:   reason,
	}
}
