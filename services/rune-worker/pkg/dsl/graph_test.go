package dsl

import (
	"testing"

	"rune-worker/pkg/types"
)

func TestBuildGraph(t *testing.T) {
	tests := []struct {
		name     string
		workflow *types.Workflow
		wantSize int
	}{
		{
			name: "simple workflow",
			workflow: &types.Workflow{
				Nodes: []types.Node{
					{ID: "node1"},
					{ID: "node2"},
					{ID: "node3"},
				},
				Edges: []types.Edge{
					{Src: "node1", Dst: "node2"},
					{Src: "node2", Dst: "node3"},
				},
			},
			wantSize: 3,
		},
		{
			name: "workflow with no edges",
			workflow: &types.Workflow{
				Nodes: []types.Node{
					{ID: "node1"},
					{ID: "node2"},
				},
				Edges: []types.Edge{},
			},
			wantSize: 2,
		},
		{
			name: "workflow with branching",
			workflow: &types.Workflow{
				Nodes: []types.Node{
					{ID: "node1"},
					{ID: "node2"},
					{ID: "node3"},
				},
				Edges: []types.Edge{
					{Src: "node1", Dst: "node2"},
					{Src: "node1", Dst: "node3"},
				},
			},
			wantSize: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			graph := BuildGraph(tt.workflow)
			if graph == nil {
				t.Fatal("BuildGraph() returned nil")
			}
			if got := graph.NodeCount(); got != tt.wantSize {
				t.Errorf("BuildGraph() node count = %v, want %v", got, tt.wantSize)
			}
		})
	}
}

func TestGetNeighbors(t *testing.T) {
	workflow := &types.Workflow{
		Nodes: []types.Node{
			{ID: "node1"},
			{ID: "node2"},
			{ID: "node3"},
		},
		Edges: []types.Edge{
			{Src: "node1", Dst: "node2"},
			{Src: "node1", Dst: "node3"},
		},
	}
	graph := BuildGraph(workflow)

	tests := []struct {
		name        string
		nodeID      string
		wantCount   int
		wantNodeIDs []string
	}{
		{
			name:        "node with multiple neighbors",
			nodeID:      "node1",
			wantCount:   2,
			wantNodeIDs: []string{"node2", "node3"},
		},
		{
			name:        "node with no neighbors",
			nodeID:      "node2",
			wantCount:   0,
			wantNodeIDs: []string{},
		},
		{
			name:        "non-existent node",
			nodeID:      "nonexistent",
			wantCount:   0,
			wantNodeIDs: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			neighbors := graph.GetNeighbors(tt.nodeID)
			if len(neighbors) != tt.wantCount {
				t.Errorf("GetNeighbors(%v) returned %d neighbors, want %d", tt.nodeID, len(neighbors), tt.wantCount)
			}

			if tt.wantCount > 0 {
				neighborMap := make(map[string]bool)
				for _, n := range neighbors {
					neighborMap[n] = true
				}
				for _, wantID := range tt.wantNodeIDs {
					if !neighborMap[wantID] {
						t.Errorf("GetNeighbors(%v) missing expected neighbor: %s", tt.nodeID, wantID)
					}
				}
			}
		})
	}
}

func TestHasNode(t *testing.T) {
	workflow := &types.Workflow{
		Nodes: []types.Node{
			{ID: "node1"},
			{ID: "node2"},
		},
		Edges: []types.Edge{},
	}
	graph := BuildGraph(workflow)

	tests := []struct {
		name   string
		nodeID string
		want   bool
	}{
		{"existing node 1", "node1", true},
		{"existing node 2", "node2", true},
		{"non-existing node", "node3", false},
		{"empty node ID", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := graph.HasNode(tt.nodeID); got != tt.want {
				t.Errorf("HasNode(%v) = %v, want %v", tt.nodeID, got, tt.want)
			}
		})
	}
}

func TestNodeCount(t *testing.T) {
	tests := []struct {
		name      string
		workflow  *types.Workflow
		wantCount int
	}{
		{
			name: "three nodes",
			workflow: &types.Workflow{
				Nodes: []types.Node{
					{ID: "node1"},
					{ID: "node2"},
					{ID: "node3"},
				},
				Edges: []types.Edge{},
			},
			wantCount: 3,
		},
		{
			name: "zero nodes",
			workflow: &types.Workflow{
				Nodes: []types.Node{},
				Edges: []types.Edge{},
			},
			wantCount: 0,
		},
		{
			name: "one node",
			workflow: &types.Workflow{
				Nodes: []types.Node{
					{ID: "node1"},
				},
				Edges: []types.Edge{},
			},
			wantCount: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			graph := BuildGraph(tt.workflow)
			if got := graph.NodeCount(); got != tt.wantCount {
				t.Errorf("NodeCount() = %v, want %v", got, tt.wantCount)
			}
		})
	}
}

func TestGetAllNodes(t *testing.T) {
	workflow := &types.Workflow{
		Nodes: []types.Node{
			{ID: "node1"},
			{ID: "node2"},
			{ID: "node3"},
		},
		Edges: []types.Edge{},
	}
	graph := BuildGraph(workflow)

	nodes := graph.GetAllNodes()
	if len(nodes) != 3 {
		t.Errorf("GetAllNodes() returned %d nodes, want 3", len(nodes))
	}

	nodeMap := make(map[string]bool)
	for _, id := range nodes {
		nodeMap[id] = true
	}

	expectedNodes := []string{"node1", "node2", "node3"}
	for _, expected := range expectedNodes {
		if !nodeMap[expected] {
			t.Errorf("GetAllNodes() missing expected node: %s", expected)
		}
	}
}

func TestIsLeafNode(t *testing.T) {
	workflow := &types.Workflow{
		Nodes: []types.Node{
			{ID: "node1"},
			{ID: "node2"},
			{ID: "node3"},
		},
		Edges: []types.Edge{
			{Src: "node1", Dst: "node2"},
			{Src: "node2", Dst: "node3"},
		},
	}
	graph := BuildGraph(workflow)

	tests := []struct {
		name   string
		nodeID string
		want   bool
	}{
		{"leaf node", "node3", true},
		{"non-leaf node", "node1", false},
		{"non-leaf node", "node2", false},
		{"non-existent node", "node4", true}, // Non-existent nodes return true (no neighbors)
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := graph.IsLeafNode(tt.nodeID); got != tt.want {
				t.Errorf("IsLeafNode(%v) = %v, want %v", tt.nodeID, got, tt.want)
			}
		})
	}
}

func TestGetLeafNodes(t *testing.T) {
	tests := []struct {
		name        string
		workflow    *types.Workflow
		wantCount   int
		wantNodeIDs []string
	}{
		{
			name: "single leaf node",
			workflow: &types.Workflow{
				Nodes: []types.Node{
					{ID: "node1"},
					{ID: "node2"},
					{ID: "node3"},
				},
				Edges: []types.Edge{
					{Src: "node1", Dst: "node2"},
					{Src: "node2", Dst: "node3"},
				},
			},
			wantCount:   1,
			wantNodeIDs: []string{"node3"},
		},
		{
			name: "multiple leaf nodes",
			workflow: &types.Workflow{
				Nodes: []types.Node{
					{ID: "node1"},
					{ID: "node2"},
					{ID: "node3"},
				},
				Edges: []types.Edge{
					{Src: "node1", Dst: "node2"},
					{Src: "node1", Dst: "node3"},
				},
			},
			wantCount:   2,
			wantNodeIDs: []string{"node2", "node3"},
		},
		{
			name: "all nodes are leaf nodes",
			workflow: &types.Workflow{
				Nodes: []types.Node{
					{ID: "node1"},
					{ID: "node2"},
				},
				Edges: []types.Edge{},
			},
			wantCount:   2,
			wantNodeIDs: []string{"node1", "node2"},
		},
		{
			name: "no leaf nodes (cycle)",
			workflow: &types.Workflow{
				Nodes: []types.Node{
					{ID: "node1"},
					{ID: "node2"},
				},
				Edges: []types.Edge{
					{Src: "node1", Dst: "node2"},
					{Src: "node2", Dst: "node1"},
				},
			},
			wantCount:   0,
			wantNodeIDs: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			graph := BuildGraph(tt.workflow)
			leafNodes := graph.GetLeafNodes()

			if len(leafNodes) != tt.wantCount {
				t.Errorf("GetLeafNodes() returned %d nodes, want %d", len(leafNodes), tt.wantCount)
			}

			if tt.wantCount > 0 {
				leafMap := make(map[string]bool)
				for _, id := range leafNodes {
					leafMap[id] = true
				}
				for _, wantID := range tt.wantNodeIDs {
					if !leafMap[wantID] {
						t.Errorf("GetLeafNodes() missing expected leaf node: %s", wantID)
					}
				}
			}
		})
	}
}

func TestGraphWithComplexTopology(t *testing.T) {
	// Test a more complex workflow with multiple branches and levels
	workflow := &types.Workflow{
		Nodes: []types.Node{
			{ID: "start"},
			{ID: "branch1"},
			{ID: "branch2"},
			{ID: "merge"},
			{ID: "end"},
		},
		Edges: []types.Edge{
			{Src: "start", Dst: "branch1"},
			{Src: "start", Dst: "branch2"},
			{Src: "branch1", Dst: "merge"},
			{Src: "branch2", Dst: "merge"},
			{Src: "merge", Dst: "end"},
		},
	}

	graph := BuildGraph(workflow)

	// Verify node count
	if graph.NodeCount() != 5 {
		t.Errorf("NodeCount() = %v, want 5", graph.NodeCount())
	}

	// Verify start node has 2 neighbors
	startNeighbors := graph.GetNeighbors("start")
	if len(startNeighbors) != 2 {
		t.Errorf("start node has %d neighbors, want 2", len(startNeighbors))
	}

	// Verify merge node has 1 neighbor
	mergeNeighbors := graph.GetNeighbors("merge")
	if len(mergeNeighbors) != 1 {
		t.Errorf("merge node has %d neighbors, want 1", len(mergeNeighbors))
	}

	// Verify end node is a leaf
	if !graph.IsLeafNode("end") {
		t.Error("end node should be a leaf node")
	}

	// Verify only one leaf node
	leafNodes := graph.GetLeafNodes()
	if len(leafNodes) != 1 {
		t.Errorf("GetLeafNodes() returned %d nodes, want 1", len(leafNodes))
	}
}
