package executor

import (
	"log/slog"

	"rune-worker/pkg/core"
	"rune-worker/pkg/dsl"
)

// determineNextNodes implements the graph traversal algorithm from RFC-001 Section 7.3.
func (e *Executor) determineNextNodes(wf *core.Workflow, currentNode *core.Node, output map[string]any) []string {
	graph := dsl.BuildGraph(wf)
	outgoingEdges := e.getOutgoingEdges(wf, currentNode.ID)

	switch currentNode.Type {
	case "conditional":
		// Evaluate condition and follow true/false edge
		return e.handleConditionalNode(currentNode, output, wf)

	case "switch":
		return e.handleSwitchNode(currentNode, output, wf)

	case "split":
		// Parallel execution - return all destinations
		nextNodes := make([]string, 0, len(outgoingEdges))
		for _, edge := range outgoingEdges {
			nextNodes = append(nextNodes, edge.Dst)
		}
		return nextNodes

	default:
		// Regular node - return all successor nodes
		return graph.GetNeighbors(currentNode.ID)
	}
}

// getOutgoingEdges returns all edges originating from the given node.
func (e *Executor) getOutgoingEdges(wf *core.Workflow, nodeID string) []core.Edge {
	edges := make([]core.Edge, 0)
	for _, edge := range wf.Edges {
		if edge.Src == nodeID {
			edges = append(edges, edge)
		}
	}
	return edges
}

// handleConditionalNode evaluates a conditional node and returns the appropriate next node.
func (e *Executor) handleConditionalNode(node *core.Node, output map[string]any, wf *core.Workflow) []string {
	// Extract true_edge_id and false_edge_id from parameters
	trueEdgeID, _ := node.Parameters["true_edge_id"].(string)
	falseEdgeID, _ := node.Parameters["false_edge_id"].(string)

	// Get result from output
	result, ok := output["result"].(bool)
	if !ok {
		slog.Warn("conditional node did not return boolean result, defaulting to false", "node_id", node.ID)
		result = false
	}

	var edgeID string
	if result {
		edgeID = trueEdgeID
	} else {
		edgeID = falseEdgeID
	}

	if edgeID == "" {
		return []string{}
	}

	// Find the destination node for this edge
	for _, edge := range wf.Edges {
		if edge.ID == edgeID {
			return []string{edge.Dst}
		}
	}

	slog.Warn("conditional edge not found", "edge_id", edgeID, "node_id", node.ID)
	return []string{}
}

// handleSwitchNode evaluates a switch node and returns the appropriate next node.
func (e *Executor) handleSwitchNode(node *core.Node, output map[string]any, wf *core.Workflow) []string {
	// Get output index
	var outputIndex int
	if val, ok := output["output_index"].(int); ok {
		outputIndex = val
	} else if val, ok := output["output_index"].(float64); ok {
		outputIndex = int(val)
	} else {
		slog.Warn("switch node did not return valid output_index", "node_id", node.ID)
		return []string{}
	}

	// Get routes parameter
	routesParam, ok := node.Parameters["routes"].([]interface{})
	if !ok {
		slog.Warn("switch node missing routes parameter", "node_id", node.ID)
		return []string{}
	}

	if outputIndex < 0 || outputIndex >= len(routesParam) {
		slog.Warn("switch node output_index out of bounds", "index", outputIndex, "routes_len", len(routesParam), "node_id", node.ID)
		return []string{}
	}

	edgeID, ok := routesParam[outputIndex].(string)
	if !ok {
		slog.Warn("invalid route edge ID", "index", outputIndex, "node_id", node.ID)
		return []string{}
	}

	// Find the destination node for this edge
	for _, edge := range wf.Edges {
		if edge.ID == edgeID {
			return []string{edge.Dst}
		}
	}

	slog.Warn("switch edge not found", "edge_id", edgeID, "node_id", node.ID)
	return []string{}
}

// getNodeByErrorEdge finds the destination node of an error edge.
func (e *Executor) getNodeByErrorEdge(wf *core.Workflow, errorEdgeID string) *core.Node {
	for _, edge := range wf.Edges {
		if edge.ID == errorEdgeID {
			if node, found := wf.GetNodeByID(edge.Dst); found {
				return &node
			}
		}
	}
	return nil
}
