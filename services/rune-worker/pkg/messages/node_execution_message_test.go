package messages

import (
	"testing"

	"rune-worker/pkg/core"
)

func makeTestWorkflow() core.Workflow {
	return core.Workflow{
		WorkflowID:  "wf-1",
		ExecutionID: "exec-1",
		Nodes: []core.Node{
			{
				ID:         "node-1",
				Name:       "Node 1",
				Type:       "conditional",
				Parameters: map[string]any{"expression": "true"},
			},
		},
	}
}

func TestNodeExecutionMessageValidate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		msg     NodeExecutionMessage
		wantErr bool
	}{
		{
			name: "valid message",
			msg: NodeExecutionMessage{
				WorkflowID:         "wf-1",
				ExecutionID:        "exec-1",
				CurrentNode:        "node-1",
				WorkflowDefinition: makeTestWorkflow(),
				AccumulatedContext: map[string]any{"$trigger": true},
			},
		},
		{
			name: "missing workflow id",
			msg: NodeExecutionMessage{
				ExecutionID:        "exec-1",
				CurrentNode:        "node-1",
				WorkflowDefinition: makeTestWorkflow(),
			},
			wantErr: true,
		},
		{
			name: "missing execution id",
			msg: NodeExecutionMessage{
				WorkflowID:         "wf-1",
				CurrentNode:        "node-1",
				WorkflowDefinition: makeTestWorkflow(),
			},
			wantErr: true,
		},
		{
			name: "missing current node",
			msg: NodeExecutionMessage{
				WorkflowID:         "wf-1",
				ExecutionID:        "exec-1",
				WorkflowDefinition: makeTestWorkflow(),
			},
			wantErr: true,
		},
		{
			name: "empty workflow nodes",
			msg: NodeExecutionMessage{
				WorkflowID:  "wf-1",
				ExecutionID: "exec-1",
				CurrentNode: "node-1",
				WorkflowDefinition: core.Workflow{
					WorkflowID:  "wf-1",
					ExecutionID: "exec-1",
					Nodes:       nil,
				},
			},
			wantErr: true,
		},
		{
			name: "current node not in workflow",
			msg: NodeExecutionMessage{
				WorkflowID:         "wf-1",
				ExecutionID:        "exec-1",
				CurrentNode:        "missing-node",
				WorkflowDefinition: makeTestWorkflow(),
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := tt.msg.Validate()
			if tt.wantErr && err == nil {
				t.Fatalf("expected error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
		})
	}
}

func TestNodeExecutionMessageEncodeDecodeRoundTrip(t *testing.T) {
	t.Parallel()

	msg := &NodeExecutionMessage{
		WorkflowID:         "wf-1",
		ExecutionID:        "exec-1",
		CurrentNode:        "node-1",
		WorkflowDefinition: makeTestWorkflow(),
		AccumulatedContext: map[string]any{"$trigger": map[string]any{"id": 42}},
		LineageStack: []StackFrame{
			{
				SplitNodeID: "split-1",
				BranchID:    "branch-1",
				ItemIndex:   0,
				TotalItems:  2,
			},
		},
		FromNode:          "trigger-1",
		IsWorkerInitiated: true,
	}

	payload, err := msg.Encode()
	if err != nil {
		t.Fatalf("encode failed: %v", err)
	}

	decoded, err := DecodeNodeExecutionMessage(payload)
	if err != nil {
		t.Fatalf("decode failed: %v", err)
	}

	if decoded.WorkflowID != msg.WorkflowID {
		t.Fatalf("workflow id mismatch: got %s want %s", decoded.WorkflowID, msg.WorkflowID)
	}
	if decoded.ExecutionID != msg.ExecutionID {
		t.Fatalf("execution id mismatch: got %s want %s", decoded.ExecutionID, msg.ExecutionID)
	}
	if decoded.CurrentNode != msg.CurrentNode {
		t.Fatalf("current node mismatch: got %s want %s", decoded.CurrentNode, msg.CurrentNode)
	}
	if decoded.FromNode != msg.FromNode {
		t.Fatalf("from_node mismatch: got %s want %s", decoded.FromNode, msg.FromNode)
	}
	if !decoded.IsWorkerInitiated {
		t.Fatalf("expected is_worker_initiated=true")
	}
	if len(decoded.LineageStack) != 1 {
		t.Fatalf("lineage stack length mismatch: got %d", len(decoded.LineageStack))
	}
}

func TestNodeExecutionMessageGetCurrentNodeDetails(t *testing.T) {
	t.Parallel()

	msg := &NodeExecutionMessage{
		WorkflowID:         "wf-1",
		ExecutionID:        "exec-1",
		CurrentNode:        "node-1",
		WorkflowDefinition: makeTestWorkflow(),
	}

	node, err := msg.GetCurrentNodeDetails()
	if err != nil {
		t.Fatalf("expected node, got error: %v", err)
	}
	if node.ID != "node-1" {
		t.Fatalf("unexpected node id: %s", node.ID)
	}

	msg.CurrentNode = "missing"
	if _, err := msg.GetCurrentNodeDetails(); err == nil {
		t.Fatalf("expected error for missing node")
	}
}
