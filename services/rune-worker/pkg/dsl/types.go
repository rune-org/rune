package dsl

import "errors"

// Workflow models a workflow definition parsed from the DSL.
type Workflow struct {
	Name   string           `json:"name"`
	Start  []string         `json:"start"`
	Nodes  []NodeDefinition `json:"nodes"`
	Edges  []EdgeDefinition `json:"edges"`
	Params map[string]any   `json:"params"`
}

// NodeDefinition describes a node within the workflow graph.
type NodeDefinition struct {
	ID     string         `json:"id"`
	Type   string         `json:"type"`
	Config map[string]any `json:"config"`
}

// EdgeDefinition connects two nodes in the workflow graph.
type EdgeDefinition struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// Validate ensures the workflow definition is well-formed.
func (w *Workflow) Validate() error {
	if w == nil {
		return errors.New("workflow is nil")
	}
	if w.Name == "" {
		return errors.New("workflow name is required")
	}
	if len(w.Nodes) == 0 {
		return errors.New("workflow requires at least one node")
	}

	index := make(map[string]NodeDefinition, len(w.Nodes))
	for _, node := range w.Nodes {
		if node.ID == "" {
			return errors.New("node id is required")
		}
		if node.Type == "" {
			return errors.New("node type is required")
		}
		index[node.ID] = node
	}

	for _, start := range w.Start {
		if _, ok := index[start]; !ok {
			return errors.New("start node not found: " + start)
		}
	}

	for _, edge := range w.Edges {
		if edge.From == "" || edge.To == "" {
			return errors.New("edge endpoints are required")
		}
		if _, ok := index[edge.From]; !ok {
			return errors.New("edge from node not found: " + edge.From)
		}
		if _, ok := index[edge.To]; !ok {
			return errors.New("edge to node not found: " + edge.To)
		}
	}

	return nil
}
