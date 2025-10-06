package messages

import (
	"encoding/json"
	"fmt"
)

// WorkflowStartedMessage represents the payload published by the workflow scheduler.
type WorkflowStartedMessage struct {
	WorkflowID string          `json:"workflow_id"`
	Definition json.RawMessage `json:"definition"`
	Context    map[string]any  `json:"context"`
}

// DecodeMessage parses a message payload into a Message structure.
func DecodeMessage(payload []byte) (WorkflowStartedMessage, error) {
	var msg WorkflowStartedMessage
	if err := json.Unmarshal(payload, &msg); err != nil {
		return WorkflowStartedMessage{}, fmt.Errorf("decode workflow message: %w", err)
	}

	if msg.WorkflowID == "" {
		return WorkflowStartedMessage{}, fmt.Errorf("decode workflow message: workflow_id is required")
	}

	return msg, nil
}