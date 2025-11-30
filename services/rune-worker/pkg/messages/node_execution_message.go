package messages

import (
	"encoding/json"
	"fmt"

	"rune-worker/pkg/core"
)

// NodeExecutionMessage instructs a worker to execute a specific node.
// This message is consumed from the workflow.execution queue.
//
// It serves dual purposes:
// 1. Initial workflow start (published by master service with current_node pointing to first node)
// 2. Recursive node execution (published by workers after completing a node)
//
// The master service publishes the initial message after trigger execution.
// Workers consume, execute the node, then publish new messages for next nodes.
type NodeExecutionMessage struct {
	WorkflowID         string                 `json:"workflow_id"`
	ExecutionID        string                 `json:"execution_id"`
	CurrentNode        string                 `json:"current_node"`        // Node ID to execute
	WorkflowDefinition core.Workflow         `json:"workflow_definition"` // Complete workflow structure
	AccumulatedContext map[string]interface{} `json:"accumulated_context"` // Context with $<node_name> keys
	LineageStack       []StackFrame           `json:"lineage_stack,omitempty"` // Stack of split contexts
}

// StackFrame represents a single level of split execution context.
type StackFrame struct {
	SplitNodeID string `json:"split_node_id"` // The node that generated this split
	BranchID    string `json:"branch_id"`     // Unique ID for this branch execution
	ItemIndex   int    `json:"item_index"`    // 0-based index of this item
	TotalItems  int    `json:"total_items"`   // Total count in this batch
}

// Validate checks if the NodeExecutionMessage has all required fields.
func (m *NodeExecutionMessage) Validate() error {
	if m.WorkflowID == "" {
		return fmt.Errorf("workflow_id is required")
	}
	if m.ExecutionID == "" {
		return fmt.Errorf("execution_id is required")
	}
	if m.CurrentNode == "" {
		return fmt.Errorf("current_node is required")
	}
	if len(m.WorkflowDefinition.Nodes) == 0 {
		return fmt.Errorf("workflow_definition must contain at least one node")
	}

	// Verify current_node exists in workflow definition
	if _, found := m.WorkflowDefinition.GetNodeByID(m.CurrentNode); !found {
		return fmt.Errorf("current_node %s not found in workflow definition", m.CurrentNode)
	}

	return nil
}

// GetCurrentNodeDetails returns the node object for the current node to execute.
func (m *NodeExecutionMessage) GetCurrentNodeDetails() (core.Node, error) {
	node, found := m.WorkflowDefinition.GetNodeByID(m.CurrentNode)
	if !found {
		return core.Node{}, fmt.Errorf("current_node %s not found in workflow", m.CurrentNode)
	}
	return node, nil
}

// DecodeNodeExecutionMessage parses a message payload into a NodeExecutionMessage.
func DecodeNodeExecutionMessage(payload []byte) (*NodeExecutionMessage, error) {
	var msg NodeExecutionMessage
	if err := json.Unmarshal(payload, &msg); err != nil {
		return nil, fmt.Errorf("decode node execution message: %w", err)
	}

	if err := msg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid node execution message: %w", err)
	}

	return &msg, nil
}

// Encode serializes the NodeExecutionMessage to JSON bytes.
func (m *NodeExecutionMessage) Encode() ([]byte, error) {
	if err := m.Validate(); err != nil {
		return nil, fmt.Errorf("cannot encode invalid message: %w", err)
	}

	data, err := json.Marshal(m)
	if err != nil {
		return nil, fmt.Errorf("encode node execution message: %w", err)
	}
	return data, nil
}
