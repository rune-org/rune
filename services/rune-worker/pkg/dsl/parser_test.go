package dsl

import (
	"testing"
)

func TestParseWorkflow(t *testing.T) {
	tests := []struct {
		name    string
		data    []byte
		wantErr bool
		errMsg  string
	}{
		{
			name:    "empty data",
			data:    []byte{},
			wantErr: true,
			errMsg:  "empty data",
		},
		{
			name:    "invalid json",
			data:    []byte("invalid json"),
			wantErr: true,
			errMsg:  "failed to unmarshal JSON",
		},
		{
			name: "valid workflow",
			data: []byte(`{
				"workflow_id": "wf-123",
				"execution_id": "exec-456",
				"nodes": [
					{
						"id": "node1",
						"name": "Test Node",
						"type": "http",
						"parameters": {},
						"output": {}
					}
				],
				"edges": []
			}`),
			wantErr: false,
		},
		{
			name: "missing workflow_id",
			data: []byte(`{
				"execution_id": "exec-456",
				"nodes": [
					{
						"id": "node1",
						"name": "Test Node",
						"type": "http",
						"parameters": {},
						"output": {}
					}
				],
				"edges": []
			}`),
			wantErr: true,
			errMsg:  "workflow_id is required",
		},
		{
			name: "missing execution_id",
			data: []byte(`{
				"workflow_id": "wf-123",
				"nodes": [
					{
						"id": "node1",
						"name": "Test Node",
						"type": "http",
						"parameters": {},
						"output": {}
					}
				],
				"edges": []
			}`),
			wantErr: true,
			errMsg:  "execution_id is required",
		},
		{
			name: "no nodes",
			data: []byte(`{
				"workflow_id": "wf-123",
				"execution_id": "exec-456",
				"nodes": [],
				"edges": []
			}`),
			wantErr: true,
			errMsg:  "at least one node",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			wf, err := ParseWorkflow(tt.data)
			if tt.wantErr {
				if err == nil {
					t.Errorf("ParseWorkflow() expected error containing %q, got nil", tt.errMsg)
				} else if tt.errMsg != "" && !contains(err.Error(), tt.errMsg) {
					t.Errorf("ParseWorkflow() error = %v, want error containing %q", err, tt.errMsg)
				}
				return
			}
			if err != nil {
				t.Errorf("ParseWorkflow() unexpected error = %v", err)
				return
			}
			if wf == nil {
				t.Error("ParseWorkflow() returned nil workflow")
			}
		})
	}
}

func TestParseWorkflowFromString(t *testing.T) {
	jsonStr := `{
		"workflow_id": "wf-123",
		"execution_id": "exec-456",
		"nodes": [
			{
				"id": "node1",
				"name": "Test Node",
				"type": "http",
				"parameters": {},
				"output": {}
			}
		],
		"edges": []
	}`

	wf, err := ParseWorkflowFromString(jsonStr)
	if err != nil {
		t.Errorf("ParseWorkflowFromString() error = %v", err)
		return
	}
	if wf == nil {
		t.Error("ParseWorkflowFromString() returned nil workflow")
	}
	if wf.WorkflowID != "wf-123" {
		t.Errorf("ParseWorkflowFromString() workflow_id = %v, want %v", wf.WorkflowID, "wf-123")
	}
}

func TestValidateWorkflowStructure(t *testing.T) {
	tests := []struct {
		name    string
		wf      *Workflow
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid workflow",
			wf: &Workflow{
				WorkflowID:  "wf-123",
				ExecutionID: "exec-456",
				Nodes: []Node{
					{
						ID:         "node1",
						Name:       "Test Node",
						Type:       NodeTypeHTTP,
						Parameters: map[string]any{},
						Output:     map[string]any{},
					},
				},
				Edges: []Edge{},
			},
			wantErr: false,
		},
		{
			name: "duplicate node IDs",
			wf: &Workflow{
				WorkflowID:  "wf-123",
				ExecutionID: "exec-456",
				Nodes: []Node{
					{
						ID:         "node1",
						Name:       "Test Node 1",
						Type:       NodeTypeHTTP,
						Parameters: map[string]any{},
						Output:     map[string]any{},
					},
					{
						ID:         "node1",
						Name:       "Test Node 2",
						Type:       NodeTypeHTTP,
						Parameters: map[string]any{},
						Output:     map[string]any{},
					},
				},
				Edges: []Edge{},
			},
			wantErr: true,
			errMsg:  "duplicate node ID",
		},
		{
			name: "empty node ID",
			wf: &Workflow{
				WorkflowID:  "wf-123",
				ExecutionID: "exec-456",
				Nodes: []Node{
					{
						ID:         "",
						Name:       "Test Node",
						Type:       NodeTypeHTTP,
						Parameters: map[string]any{},
						Output:     map[string]any{},
					},
				},
				Edges: []Edge{},
			},
			wantErr: true,
			errMsg:  "empty ID",
		},
		{
			name: "invalid node type",
			wf: &Workflow{
				WorkflowID:  "wf-123",
				ExecutionID: "exec-456",
				Nodes: []Node{
					{
						ID:         "node1",
						Name:       "Test Node",
						Type:       "invalid_type",
						Parameters: map[string]any{},
						Output:     map[string]any{},
					},
				},
				Edges: []Edge{},
			},
			wantErr: true,
			errMsg:  "invalid type",
		},
		{
			name: "edge references non-existent node",
			wf: &Workflow{
				WorkflowID:  "wf-123",
				ExecutionID: "exec-456",
				Nodes: []Node{
					{
						ID:         "node1",
						Name:       "Test Node",
						Type:       NodeTypeHTTP,
						Parameters: map[string]any{},
						Output:     map[string]any{},
					},
				},
				Edges: []Edge{
					{
						ID:  "edge1",
						Src: "node1",
						Dst: "nonexistent",
					},
				},
			},
			wantErr: true,
			errMsg:  "non-existent",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateWorkflowStructure(tt.wf)
			if tt.wantErr {
				if err == nil {
					t.Errorf("validateWorkflowStructure() expected error containing %q, got nil", tt.errMsg)
				} else if !contains(err.Error(), tt.errMsg) {
					t.Errorf("validateWorkflowStructure() error = %v, want error containing %q", err, tt.errMsg)
				}
				return
			}
			if err != nil {
				t.Errorf("validateWorkflowStructure() unexpected error = %v", err)
			}
		})
	}
}

func TestIsValidNodeType(t *testing.T) {
	tests := []struct {
		name     string
		nodeType string
		want     bool
	}{
		{"http type", NodeTypeHTTP, true},
		{"smtp type", NodeTypeSMTP, true},
		{"conditional type", NodeTypeConditional, true},
		{"manual trigger type", NodeTypeManualTrigger, true},
		{"log type", NodeTypeLog, true},
		{"invalid type", "invalid", false},
		{"empty type", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isValidNodeType(tt.nodeType); got != tt.want {
				t.Errorf("isValidNodeType(%v) = %v, want %v", tt.nodeType, got, tt.want)
			}
		})
	}
}

func TestValidateErrorHandling(t *testing.T) {
	tests := []struct {
		name    string
		eh      *ErrorHandling
		nodeID  string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "halt type",
			eh:      &ErrorHandling{Type: ErrorHandlingHalt},
			nodeID:  "node1",
			wantErr: false,
		},
		{
			name:    "ignore type",
			eh:      &ErrorHandling{Type: ErrorHandlingIgnore},
			nodeID:  "node1",
			wantErr: false,
		},
		{
			name:    "branch type with error edge",
			eh:      &ErrorHandling{Type: ErrorHandlingBranch, ErrorEdge: "error-edge-1"},
			nodeID:  "node1",
			wantErr: false,
		},
		{
			name:    "branch type without error edge",
			eh:      &ErrorHandling{Type: ErrorHandlingBranch},
			nodeID:  "node1",
			wantErr: true,
			errMsg:  "no error_edge specified",
		},
		{
			name:    "invalid error handling type",
			eh:      &ErrorHandling{Type: "invalid"},
			nodeID:  "node1",
			wantErr: true,
			errMsg:  "invalid error handling type",
		},
		{
			name:    "empty error handling type",
			eh:      &ErrorHandling{Type: ""},
			nodeID:  "node1",
			wantErr: true,
			errMsg:  "empty type",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateErrorHandling(tt.eh, tt.nodeID)
			if tt.wantErr {
				if err == nil {
					t.Errorf("validateErrorHandling() expected error containing %q, got nil", tt.errMsg)
				} else if !contains(err.Error(), tt.errMsg) {
					t.Errorf("validateErrorHandling() error = %v, want error containing %q", err, tt.errMsg)
				}
				return
			}
			if err != nil {
				t.Errorf("validateErrorHandling() unexpected error = %v", err)
			}
		})
	}
}

func TestHasCycle(t *testing.T) {
	tests := []struct {
		name      string
		workflow  *Workflow
		wantCycle bool
	}{
		{
			name: "no cycle - linear workflow",
			workflow: &Workflow{
				Nodes: []Node{
					{ID: "node1"},
					{ID: "node2"},
					{ID: "node3"},
				},
				Edges: []Edge{
					{Src: "node1", Dst: "node2"},
					{Src: "node2", Dst: "node3"},
				},
			},
			wantCycle: false,
		},
		{
			name: "simple cycle",
			workflow: &Workflow{
				Nodes: []Node{
					{ID: "node1"},
					{ID: "node2"},
				},
				Edges: []Edge{
					{Src: "node1", Dst: "node2"},
					{Src: "node2", Dst: "node1"},
				},
			},
			wantCycle: true,
		},
		{
			name: "complex cycle",
			workflow: &Workflow{
				Nodes: []Node{
					{ID: "node1"},
					{ID: "node2"},
					{ID: "node3"},
				},
				Edges: []Edge{
					{Src: "node1", Dst: "node2"},
					{Src: "node2", Dst: "node3"},
					{Src: "node3", Dst: "node1"},
				},
			},
			wantCycle: true,
		},
		{
			name: "no cycle - branching workflow",
			workflow: &Workflow{
				Nodes: []Node{
					{ID: "node1"},
					{ID: "node2"},
					{ID: "node3"},
				},
				Edges: []Edge{
					{Src: "node1", Dst: "node2"},
					{Src: "node1", Dst: "node3"},
				},
			},
			wantCycle: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			graph := BuildGraph(tt.workflow)
			if got := hasCycle(graph); got != tt.wantCycle {
				t.Errorf("hasCycle() = %v, want %v", got, tt.wantCycle)
			}
		})
	}
}

func TestFindEntryNodes(t *testing.T) {
	tests := []struct {
		name     string
		workflow *Workflow
		wantLen  int
		wantIDs  []string
	}{
		{
			name: "single entry node",
			workflow: &Workflow{
				Nodes: []Node{
					{ID: "node1", Name: "Entry"},
					{ID: "node2", Name: "Middle"},
					{ID: "node3", Name: "Exit"},
				},
				Edges: []Edge{
					{Src: "node1", Dst: "node2"},
					{Src: "node2", Dst: "node3"},
				},
			},
			wantLen: 1,
			wantIDs: []string{"node1"},
		},
		{
			name: "multiple entry nodes",
			workflow: &Workflow{
				Nodes: []Node{
					{ID: "node1", Name: "Entry 1"},
					{ID: "node2", Name: "Entry 2"},
					{ID: "node3", Name: "Exit"},
				},
				Edges: []Edge{
					{Src: "node1", Dst: "node3"},
					{Src: "node2", Dst: "node3"},
				},
			},
			wantLen: 2,
			wantIDs: []string{"node1", "node2"},
		},
		{
			name: "all nodes have incoming edges",
			workflow: &Workflow{
				Nodes: []Node{
					{ID: "node1"},
					{ID: "node2"},
				},
				Edges: []Edge{
					{Src: "node1", Dst: "node2"},
					{Src: "node2", Dst: "node1"},
				},
			},
			wantLen: 0,
			wantIDs: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			entryNodes := findEntryNodes(tt.workflow)
			if len(entryNodes) != tt.wantLen {
				t.Errorf("findEntryNodes() returned %d nodes, want %d", len(entryNodes), tt.wantLen)
			}
			if tt.wantLen > 0 {
				gotIDs := make(map[string]bool)
				for _, node := range entryNodes {
					gotIDs[node.ID] = true
				}
				for _, wantID := range tt.wantIDs {
					if !gotIDs[wantID] {
						t.Errorf("findEntryNodes() missing expected node ID: %s", wantID)
					}
				}
			}
		})
	}
}

func TestValidateAll(t *testing.T) {
	validWorkflow := &Workflow{
		WorkflowID:  "wf-123",
		ExecutionID: "exec-456",
		Nodes: []Node{
			{
				ID:         "node1",
				Name:       "Trigger",
				Type:       NodeTypeManualTrigger,
				Trigger:    true,
				Parameters: map[string]any{},
				Output:     map[string]any{},
			},
			{
				ID:         "node2",
				Name:       "Action",
				Type:       NodeTypeHTTP,
				Parameters: map[string]any{},
				Output:     map[string]any{},
			},
		},
		Edges: []Edge{
			{ID: "edge1", Src: "node1", Dst: "node2"},
		},
	}

	err := validateAll(validWorkflow)
	if err != nil {
		t.Errorf("validateAll() unexpected error = %v", err)
	}
}

// Helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > 0 && len(substr) > 0 && indexOf(s, substr) >= 0))
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
