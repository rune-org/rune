package messages

import (
	"encoding/json"
	"fmt"
	"time"
)

// NodeStatusMessage reports node execution progress and results.
// This message is published to the workflow.node.status queue for
// consumption by the master service to provide real-time updates to users.
type NodeStatusMessage struct {
	WorkflowID      string                 `json:"workflow_id"`
	ExecutionID     string                 `json:"execution_id"`
	NodeID          string                 `json:"node_id"`
	NodeName        string                 `json:"node_name"`
	Status          string                 `json:"status"` // "running", "success", "failed"
	Output          map[string]interface{} `json:"output,omitempty"`
	Error           *NodeError             `json:"error,omitempty"`
	ExecutedAt      time.Time              `json:"executed_at"`
	DurationMs      int64                  `json:"duration_ms"`
	BranchID        string                 `json:"branch_id,omitempty"`
	LineageStack    []StackFrame           `json:"lineage_stack,omitempty"`
	SplitNodeID     string                 `json:"split_node_id,omitempty"`
	ItemIndex       *int                   `json:"item_index,omitempty"`
	TotalItems      *int                   `json:"total_items,omitempty"`
	ProcessedCount  *int                   `json:"processed_count,omitempty"`
	AggregatorState string                 `json:"aggregator_state,omitempty"`
}

// NodeError contains error details when a node execution fails.
type NodeError struct {
	Message string                 `json:"message"`
	Code    string                 `json:"code"`
	Details map[string]interface{} `json:"details,omitempty"`
}

// Status constants for NodeStatusMessage
const (
	StatusRunning = "running"
	StatusSuccess = "success"
	StatusFailed  = "failed"

	AggregatorStateWaiting  = "waiting"
	AggregatorStateReleased = "released"
)

// Validate checks if the NodeStatusMessage has all required fields.
func (m *NodeStatusMessage) Validate() error {
	if m.WorkflowID == "" {
		return fmt.Errorf("workflow_id is required")
	}
	if m.ExecutionID == "" {
		return fmt.Errorf("execution_id is required")
	}
	if m.NodeID == "" {
		return fmt.Errorf("node_id is required")
	}
	if m.NodeName == "" {
		return fmt.Errorf("node_name is required")
	}
	if m.Status == "" {
		return fmt.Errorf("status is required")
	}

	// Validate status value
	switch m.Status {
	case StatusRunning, StatusSuccess, StatusFailed:
		// valid status
	default:
		return fmt.Errorf("invalid status: %s (must be 'running', 'success', or 'failed')", m.Status)
	}

	// Validate status-specific requirements
	// Output is optional for success status (no action needed)
	if m.Status == StatusFailed && m.Error == nil {
		return fmt.Errorf("error is required when status is 'failed'")
	}

	return nil
}

// IsRunning returns true if the node is currently running.
func (m *NodeStatusMessage) IsRunning() bool {
	return m.Status == StatusRunning
}

// IsSuccess returns true if the node completed successfully.
func (m *NodeStatusMessage) IsSuccess() bool {
	return m.Status == StatusSuccess
}

// IsFailed returns true if the node execution failed.
func (m *NodeStatusMessage) IsFailed() bool {
	return m.Status == StatusFailed
}

// DecodeNodeStatusMessage parses a message payload into a NodeStatusMessage.
func DecodeNodeStatusMessage(payload []byte) (*NodeStatusMessage, error) {
	var msg NodeStatusMessage
	if err := json.Unmarshal(payload, &msg); err != nil {
		return nil, fmt.Errorf("decode node status message: %w", err)
	}

	if err := msg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid node status message: %w", err)
	}

	return &msg, nil
}

// Encode serializes the NodeStatusMessage to JSON bytes.
func (m *NodeStatusMessage) Encode() ([]byte, error) {
	if err := m.Validate(); err != nil {
		return nil, fmt.Errorf("cannot encode invalid message: %w", err)
	}

	data, err := json.Marshal(m)
	if err != nil {
		return nil, fmt.Errorf("encode node status message: %w", err)
	}
	return data, nil
}

// NewRunningStatus creates a NodeStatusMessage with "running" status.
func NewRunningStatus(workflowID, executionID, nodeID, nodeName string) *NodeStatusMessage {
	return &NodeStatusMessage{
		WorkflowID:  workflowID,
		ExecutionID: executionID,
		NodeID:      nodeID,
		NodeName:    nodeName,
		Status:      StatusRunning,
		ExecutedAt:  time.Now(),
		DurationMs:  0,
	}
}

// NewSuccessStatus creates a NodeStatusMessage with "success" status.
func NewSuccessStatus(workflowID, executionID, nodeID, nodeName string, output map[string]interface{}, durationMs int64) *NodeStatusMessage {
	return &NodeStatusMessage{
		WorkflowID:  workflowID,
		ExecutionID: executionID,
		NodeID:      nodeID,
		NodeName:    nodeName,
		Status:      StatusSuccess,
		Output:      output,
		ExecutedAt:  time.Now(),
		DurationMs:  durationMs,
	}
}

// NewFailedStatus creates a NodeStatusMessage with "failed" status.
func NewFailedStatus(workflowID, executionID, nodeID, nodeName string, err *NodeError, durationMs int64) *NodeStatusMessage {
	return &NodeStatusMessage{
		WorkflowID:  workflowID,
		ExecutionID: executionID,
		NodeID:      nodeID,
		NodeName:    nodeName,
		Status:      StatusFailed,
		Error:       err,
		ExecutedAt:  time.Now(),
		DurationMs:  durationMs,
	}
}
