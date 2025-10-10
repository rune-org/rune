package dsl

import (
	"encoding/json"
	"fmt"

	"rune-worker/pkg/core"
)

// ParseWorkflow converts a JSON document into a validated workflow structure.
// It performs the following steps:
// 1. Unmarshals JSON into Workflow struct
// 2. Validates the workflow structure (optional - for monitoring/logging only)
// 3. Builds the execution graph
func ParseWorkflow(data []byte) (*core.Workflow, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("parse workflow: empty data")
	}

	var wf core.Workflow
	if err := json.Unmarshal(data, &wf); err != nil {
		return nil, fmt.Errorf("parse workflow: failed to unmarshal JSON: %w", err)
	}

	// OPTIONAL: Validate workflow structure (can be removed for performance)
	// All messages from master are pre-validated, this is for extra monitoring only
	if err := validateAll(&wf); err != nil {
		return nil, fmt.Errorf("parse workflow: validation failed: %w", err)
	}

	// Build the execution graph
	_ = BuildGraph(&wf)

	return &wf, nil
}

// validateAll performs comprehensive validation of the workflow structure.
// This function encapsulates ALL validation logic in one place for easy removal.
//
// NOTE: This validation is OPTIONAL and REDUNDANT as messages from the master service
// are already validated. This exists only for extra safety, logging, and monitoring.
// Can be safely removed or disabled by commenting out the call in ParseWorkflow().
func validateAll(wf *core.Workflow) error {
	// Validate basic workflow structure
	if err := validateWorkflowStructure(wf); err != nil {
		return err
	}

	// Build and validate graph
	graph := BuildGraph(wf)
	if err := validateGraphStructure(graph, wf); err != nil {
		return err
	}

	return nil
}

// validateWorkflowStructure checks if the workflow has all required fields and valid structure.
func validateWorkflowStructure(wf *core.Workflow) error {
	if wf.WorkflowID == "" {
		return fmt.Errorf("workflow_id is required")
	}

	if wf.ExecutionID == "" {
		return fmt.Errorf("execution_id is required")
	}

	if len(wf.Nodes) == 0 {
		return fmt.Errorf("workflow must have at least one node")
	}

	// Validate each node
	nodeIDs := make(map[string]bool)
	for i, node := range wf.Nodes {
		if node.ID == "" {
			return fmt.Errorf("node at index %d has empty ID", i)
		}
		if nodeIDs[node.ID] {
			return fmt.Errorf("duplicate node ID: %s", node.ID)
		}
		nodeIDs[node.ID] = true

		if node.Name == "" {
			return fmt.Errorf("node %s has empty name", node.ID)
		}

		if node.Type == "" {
			return fmt.Errorf("node %s has empty type", node.ID)
		}

		// Validate error handling if present
		if node.Error != nil {
			if err := validateErrorHandling(node.Error, node.ID); err != nil {
				return err
			}
		}
	}

	// Validate edges
	edgeIDs := make(map[string]bool)
	for i, edge := range wf.Edges {
		if edge.ID == "" {
			return fmt.Errorf("edge at index %d has empty ID", i)
		}
		if edgeIDs[edge.ID] {
			return fmt.Errorf("duplicate edge ID: %s", edge.ID)
		}
		edgeIDs[edge.ID] = true

		if edge.Src == "" {
			return fmt.Errorf("edge %s has empty source", edge.ID)
		}
		if edge.Dst == "" {
			return fmt.Errorf("edge %s has empty destination", edge.ID)
		}

		// Check if source and destination nodes exist
		if !nodeIDs[edge.Src] {
			return fmt.Errorf("edge %s references non-existent source node: %s", edge.ID, edge.Src)
		}
		if !nodeIDs[edge.Dst] {
			return fmt.Errorf("edge %s references non-existent destination node: %s", edge.ID, edge.Dst)
		}
	}

	return nil
}

// validateErrorHandling checks if error handling configuration is valid.
func validateErrorHandling(eh *core.ErrorHandling, nodeID string) error {
	if eh.Type == "" {
		return fmt.Errorf("node %s has error handling with empty type", nodeID)
	}

	switch eh.Type {
	case core.ErrorHandlingHalt, core.ErrorHandlingIgnore:
		// These don't require additional fields
		return nil
	case core.ErrorHandlingBranch:
		if eh.ErrorEdge == "" {
			return fmt.Errorf("node %s has error handling type 'branch' but no error_edge specified", nodeID)
		}
		return nil
	default:
		return fmt.Errorf("node %s has invalid error handling type: %s", nodeID, eh.Type)
	}
}

// validateGraphStructure checks for cycles and connectivity issues in the workflow graph.
func validateGraphStructure(graph *Graph, wf *core.Workflow) error {
	// Check for cycles using DFS
	if hasCycle(graph) {
		return fmt.Errorf("workflow contains cycles")
	}

	// Check that there's at least one trigger node or entry point
	triggers := wf.GetTriggerNodes()
	if len(triggers) == 0 {
		// If no trigger nodes, check for nodes with no incoming edges
		entryNodes := findEntryNodes(wf)
		if len(entryNodes) == 0 {
			return fmt.Errorf("workflow has no trigger nodes or entry points")
		}
	}

	return nil
}

// hasCycle performs DFS to detect cycles in the graph.
func hasCycle(graph *Graph) bool {
	visited := make(map[string]bool)
	recStack := make(map[string]bool)

	for nodeID := range graph.adjacency {
		if !visited[nodeID] {
			if hasCycleDFS(nodeID, graph, visited, recStack) {
				return true
			}
		}
	}
	return false
}

// hasCycleDFS is a helper function for cycle detection using DFS.
func hasCycleDFS(nodeID string, graph *Graph, visited, recStack map[string]bool) bool {
	visited[nodeID] = true
	recStack[nodeID] = true

	for _, neighbor := range graph.adjacency[nodeID] {
		if !visited[neighbor] {
			if hasCycleDFS(neighbor, graph, visited, recStack) {
				return true
			}
		} else if recStack[neighbor] {
			return true
		}
	}

	recStack[nodeID] = false
	return false
}

// findEntryNodes returns nodes that have no incoming edges.
func findEntryNodes(wf *core.Workflow) []core.Node {
	hasIncoming := make(map[string]bool)
	for _, edge := range wf.Edges {
		hasIncoming[edge.Dst] = true
	}

	var entryNodes []core.Node
	for _, node := range wf.Nodes {
		if !hasIncoming[node.ID] {
			entryNodes = append(entryNodes, node)
		}
	}
	return entryNodes
}

// ParseWorkflowFromString is a convenience function that accepts a JSON string.
func ParseWorkflowFromString(jsonStr string) (*core.Workflow, error) {
	return ParseWorkflow([]byte(jsonStr))
}
