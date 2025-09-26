package executor

import (
	"encoding/json"
	"fmt"
)

// Message represents the payload published by the workflow scheduler.
type Message struct {
	WorkflowID string          `json:"workflow_id"`
	Definition json.RawMessage `json:"definition"`
	Context    map[string]any  `json:"context"`
}

// DecodeMessage parses a message payload into a Message structure.
func DecodeMessage(payload []byte) (Message, error) {
	var msg Message
	if err := json.Unmarshal(payload, &msg); err != nil {
		return Message{}, fmt.Errorf("decode workflow message: %w", err)
	}

	if msg.WorkflowID == "" {
		return Message{}, fmt.Errorf("decode workflow message: workflow_id is required")
	}

	return msg, nil
}
