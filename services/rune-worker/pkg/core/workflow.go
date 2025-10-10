package core

// Workflow models a workflow execution structure sent from the master service.
// It contains only the essential execution data: nodes to execute and their connections.
// Metadata like name, description, and active status are NOT included as they're stored in the master service.
// Trigger nodes are NOT executed in this service - triggers fire in the master and send their data via context.
type Workflow struct {
	WorkflowID  string `json:"workflow_id"`
	ExecutionID string `json:"execution_id"`
	Nodes       []Node `json:"nodes"`
	Edges       []Edge `json:"edges"`
}

// Edge connects two nodes in the workflow graph.
// It defines the flow of data and control between nodes.
type Edge struct {
	ID  string `json:"id"`
	Src string `json:"src"`
	Dst string `json:"dst"`
}

// GetNodeByID retrieves a node from the workflow by its ID.
// Returns the node and true if found, or an empty node and false if not found.
func (w *Workflow) GetNodeByID(id string) (Node, bool) {
	for _, node := range w.Nodes {
		if node.ID == id {
			return node, true
		}
	}
	return Node{}, false
}

// GetEdgeByID retrieves an edge from the workflow by its ID.
// Returns the edge and true if found, or an empty edge and false if not found.
func (w *Workflow) GetEdgeByID(id string) (Edge, bool) {
	for _, edge := range w.Edges {
		if edge.ID == id {
			return edge, true
		}
	}
	return Edge{}, false
}

// GetTriggerNodes returns all nodes marked as triggers.
// These are typically the starting points for workflow execution.
func (w *Workflow) GetTriggerNodes() []Node {
	var triggers []Node
	for _, node := range w.Nodes {
		if node.Trigger {
			triggers = append(triggers, node)
		}
	}
	return triggers
}

// GetOutgoingEdges returns all edges originating from the specified node.
func (w *Workflow) GetOutgoingEdges(nodeID string) []Edge {
	var edges []Edge
	for _, edge := range w.Edges {
		if edge.Src == nodeID {
			edges = append(edges, edge)
		}
	}
	return edges
}

// GetIncomingEdges returns all edges pointing to the specified node.
func (w *Workflow) GetIncomingEdges(nodeID string) []Edge {
	var edges []Edge
	for _, edge := range w.Edges {
		if edge.Dst == nodeID {
			edges = append(edges, edge)
		}
	}
	return edges
}
