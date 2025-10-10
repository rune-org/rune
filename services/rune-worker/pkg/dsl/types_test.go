package dsl

import (
	"testing"

	"rune-worker/pkg/core"
)

func TestGetNodeByID(t *testing.T) {
	workflow := &core.Workflow{
		Nodes: []core.Node{
			{ID: "node1", Name: "core.Node One", Type: core.NodeTypeHTTP},
			{ID: "node2", Name: "core.Node Two", Type: core.NodeTypeSMTP},
		},
	}

	tests := []struct {
		name      string
		nodeID    string
		wantFound bool
		wantName  string
	}{
		{"existing node 1", "node1", true, "core.Node One"},
		{"existing node 2", "node2", true, "core.Node Two"},
		{"non-existing node", "node3", false, ""},
		{"empty node ID", "", false, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node, found := workflow.GetNodeByID(tt.nodeID)
			if found != tt.wantFound {
				t.Errorf("GetNodeByID(%v) found = %v, want %v", tt.nodeID, found, tt.wantFound)
			}
			if tt.wantFound && node.Name != tt.wantName {
				t.Errorf("GetNodeByID(%v) name = %v, want %v", tt.nodeID, node.Name, tt.wantName)
			}
		})
	}
}

func TestGetEdgeByID(t *testing.T) {
	workflow := &core.Workflow{
		Edges: []core.Edge{
			{ID: "edge1", Src: "node1", Dst: "node2"},
			{ID: "edge2", Src: "node2", Dst: "node3"},
		},
	}

	tests := []struct {
		name      string
		edgeID    string
		wantFound bool
		wantSrc   string
		wantDst   string
	}{
		{"existing edge 1", "edge1", true, "node1", "node2"},
		{"existing edge 2", "edge2", true, "node2", "node3"},
		{"non-existing edge", "edge3", false, "", ""},
		{"empty edge ID", "", false, "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			edge, found := workflow.GetEdgeByID(tt.edgeID)
			if found != tt.wantFound {
				t.Errorf("GetEdgeByID(%v) found = %v, want %v", tt.edgeID, found, tt.wantFound)
			}
			if tt.wantFound {
				if edge.Src != tt.wantSrc {
					t.Errorf("GetEdgeByID(%v) src = %v, want %v", tt.edgeID, edge.Src, tt.wantSrc)
				}
				if edge.Dst != tt.wantDst {
					t.Errorf("GetEdgeByID(%v) dst = %v, want %v", tt.edgeID, edge.Dst, tt.wantDst)
				}
			}
		})
	}
}

func TestGetTriggerNodes(t *testing.T) {
	tests := []struct {
		name      string
		workflow  *core.Workflow
		wantCount int
		wantIDs   []string
	}{
		{
			name: "single trigger",
			workflow: &core.Workflow{
				Nodes: []core.Node{
					{ID: "trigger1", Trigger: true},
					{ID: "node1", Trigger: false},
					{ID: "node2", Trigger: false},
				},
			},
			wantCount: 1,
			wantIDs:   []string{"trigger1"},
		},
		{
			name: "multiple triggers",
			workflow: &core.Workflow{
				Nodes: []core.Node{
					{ID: "trigger1", Trigger: true},
					{ID: "node1", Trigger: false},
					{ID: "trigger2", Trigger: true},
				},
			},
			wantCount: 2,
			wantIDs:   []string{"trigger1", "trigger2"},
		},
		{
			name: "no triggers",
			workflow: &core.Workflow{
				Nodes: []core.Node{
					{ID: "node1", Trigger: false},
					{ID: "node2", Trigger: false},
				},
			},
			wantCount: 0,
			wantIDs:   []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			triggers := tt.workflow.GetTriggerNodes()
			if len(triggers) != tt.wantCount {
				t.Errorf("GetTriggerNodes() returned %d triggers, want %d", len(triggers), tt.wantCount)
			}

			if tt.wantCount > 0 {
				triggerMap := make(map[string]bool)
				for _, trigger := range triggers {
					triggerMap[trigger.ID] = true
				}
				for _, wantID := range tt.wantIDs {
					if !triggerMap[wantID] {
						t.Errorf("GetTriggerNodes() missing expected trigger: %s", wantID)
					}
				}
			}
		})
	}
}

func TestGetOutgoingEdges(t *testing.T) {
	workflow := &core.Workflow{
		Edges: []core.Edge{
			{ID: "edge1", Src: "node1", Dst: "node2"},
			{ID: "edge2", Src: "node1", Dst: "node3"},
			{ID: "edge3", Src: "node2", Dst: "node3"},
		},
	}

	tests := []struct {
		name      string
		nodeID    string
		wantCount int
		wantEdges []string
	}{
		{
			name:      "node with multiple outgoing edges",
			nodeID:    "node1",
			wantCount: 2,
			wantEdges: []string{"edge1", "edge2"},
		},
		{
			name:      "node with single outgoing edge",
			nodeID:    "node2",
			wantCount: 1,
			wantEdges: []string{"edge3"},
		},
		{
			name:      "node with no outgoing edges",
			nodeID:    "node3",
			wantCount: 0,
			wantEdges: []string{},
		},
		{
			name:      "non-existent node",
			nodeID:    "node4",
			wantCount: 0,
			wantEdges: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			edges := workflow.GetOutgoingEdges(tt.nodeID)
			if len(edges) != tt.wantCount {
				t.Errorf("GetOutgoingEdges(%v) returned %d edges, want %d", tt.nodeID, len(edges), tt.wantCount)
			}

			if tt.wantCount > 0 {
				edgeMap := make(map[string]bool)
				for _, edge := range edges {
					edgeMap[edge.ID] = true
				}
				for _, wantEdge := range tt.wantEdges {
					if !edgeMap[wantEdge] {
						t.Errorf("GetOutgoingEdges(%v) missing expected edge: %s", tt.nodeID, wantEdge)
					}
				}
			}
		})
	}
}

func TestGetIncomingEdges(t *testing.T) {
	workflow := &core.Workflow{
		Edges: []core.Edge{
			{ID: "edge1", Src: "node1", Dst: "node3"},
			{ID: "edge2", Src: "node2", Dst: "node3"},
			{ID: "edge3", Src: "node2", Dst: "node4"},
		},
	}

	tests := []struct {
		name      string
		nodeID    string
		wantCount int
		wantEdges []string
	}{
		{
			name:      "node with multiple incoming edges",
			nodeID:    "node3",
			wantCount: 2,
			wantEdges: []string{"edge1", "edge2"},
		},
		{
			name:      "node with single incoming edge",
			nodeID:    "node4",
			wantCount: 1,
			wantEdges: []string{"edge3"},
		},
		{
			name:      "node with no incoming edges",
			nodeID:    "node1",
			wantCount: 0,
			wantEdges: []string{},
		},
		{
			name:      "non-existent node",
			nodeID:    "node5",
			wantCount: 0,
			wantEdges: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			edges := workflow.GetIncomingEdges(tt.nodeID)
			if len(edges) != tt.wantCount {
				t.Errorf("GetIncomingEdges(%v) returned %d edges, want %d", tt.nodeID, len(edges), tt.wantCount)
			}

			if tt.wantCount > 0 {
				edgeMap := make(map[string]bool)
				for _, edge := range edges {
					edgeMap[edge.ID] = true
				}
				for _, wantEdge := range tt.wantEdges {
					if !edgeMap[wantEdge] {
						t.Errorf("GetIncomingEdges(%v) missing expected edge: %s", tt.nodeID, wantEdge)
					}
				}
			}
		})
	}
}

func TestNodeHasCredentials(t *testing.T) {
	tests := []struct {
		name string
		node core.Node
		want bool
	}{
		{
			name: "node with credentials",
			node: core.Node{
				Credentials: &core.Credential{
					ID:   "cred1",
					Name: "API Key",
					Type: "api_key",
				},
			},
			want: true,
		},
		{
			name: "node with nil credentials",
			node: core.Node{
				Credentials: nil,
			},
			want: false,
		},
		{
			name: "node with empty credential ID",
			node: core.Node{
				Credentials: &core.Credential{
					ID:   "",
					Name: "Empty",
				},
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.node.HasCredentials(); got != tt.want {
				t.Errorf("core.Node.HasCredentials() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestNodeHasErrorHandling(t *testing.T) {
	tests := []struct {
		name string
		node core.Node
		want bool
	}{
		{
			name: "node with error handling",
			node: core.Node{
				Error: &core.ErrorHandling{
					Type: core.ErrorHandlingHalt,
				},
			},
			want: true,
		},
		{
			name: "node with nil error handling",
			node: core.Node{
				Error: nil,
			},
			want: false,
		},
		{
			name: "node with empty error handling type",
			node: core.Node{
				Error: &core.ErrorHandling{
					Type: "",
				},
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.node.HasErrorHandling(); got != tt.want {
				t.Errorf("core.Node.HasErrorHandling() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestNodeTypeConstants(t *testing.T) {
	// Verify node type constants are defined
	constants := map[string]string{
		"http":          core.NodeTypeHTTP,
		"smtp":          core.NodeTypeSMTP,
		"conditional":   core.NodeTypeConditional,
		"ManualTrigger": core.NodeTypeManualTrigger,
	}

	for expected, actual := range constants {
		if actual != expected {
			t.Errorf("NodeType constant mismatch: got %v, want %v", actual, expected)
		}
	}
}

func TestErrorHandlingConstants(t *testing.T) {
	// Verify error handling type constants are defined
	constants := map[string]string{
		"halt":   core.ErrorHandlingHalt,
		"ignore": core.ErrorHandlingIgnore,
		"branch": core.ErrorHandlingBranch,
	}

	for expected, actual := range constants {
		if actual != expected {
			t.Errorf("core.ErrorHandling constant mismatch: got %v, want %v", actual, expected)
		}
	}
}

func TestOperatorConstants(t *testing.T) {
	// Verify operator constants are defined
	constants := map[string]string{
		"and": core.OperatorAnd,
		"or":  core.OperatorOr,
		"gt":  core.OperatorGT,
		"lt":  core.OperatorLT,
		"eq":  core.OperatorEQ,
		"neq": core.OperatorNEQ,
		"gte": core.OperatorGTE,
		"lte": core.OperatorLTE,
	}

	for expected, actual := range constants {
		if actual != expected {
			t.Errorf("Operator constant mismatch: got %v, want %v", actual, expected)
		}
	}
}
