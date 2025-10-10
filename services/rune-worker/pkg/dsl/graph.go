package dsl

import "rune-worker/pkg/core"

// Graph represents the workflow as an adjacency list for traversal and cycle detection.
// It maps each node ID to a list of its destination node IDs.
type Graph struct {
	adjacency map[string][]string
}

// BuildGraph constructs a graph from the workflow definition.
// It creates an adjacency list representation where each node maps to its outgoing edges.
func BuildGraph(wf *core.Workflow) *Graph {
	adj := make(map[string][]string, len(wf.Nodes))
	for _, node := range wf.Nodes {
		if _, ok := adj[node.ID]; !ok {
			adj[node.ID] = []string{}
		}
	}

	for _, edge := range wf.Edges {
		adj[edge.Src] = append(adj[edge.Src], edge.Dst)
	}

	return &Graph{adjacency: adj}
}

// GetNeighbors returns all nodes directly connected from the given node.
func (g *Graph) GetNeighbors(nodeID string) []string {
	if neighbors, ok := g.adjacency[nodeID]; ok {
		return neighbors
	}
	return []string{}
}

// HasNode checks if a node exists in the graph.
func (g *Graph) HasNode(nodeID string) bool {
	_, exists := g.adjacency[nodeID]
	return exists
}

// NodeCount returns the total number of nodes in the graph.
func (g *Graph) NodeCount() int {
	return len(g.adjacency)
}

// GetAllNodes returns a list of all node IDs in the graph.
func (g *Graph) GetAllNodes() []string {
	nodes := make([]string, 0, len(g.adjacency))
	for nodeID := range g.adjacency {
		nodes = append(nodes, nodeID)
	}
	return nodes
}

// IsLeafNode checks if a node has no outgoing edges.
func (g *Graph) IsLeafNode(nodeID string) bool {
	neighbors := g.GetNeighbors(nodeID)
	return len(neighbors) == 0
}

// GetLeafNodes returns all nodes that have no outgoing edges.
func (g *Graph) GetLeafNodes() []string {
	var leafNodes []string
	for nodeID, neighbors := range g.adjacency {
		if len(neighbors) == 0 {
			leafNodes = append(leafNodes, nodeID)
		}
	}
	return leafNodes
}
