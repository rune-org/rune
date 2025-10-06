package dsl

// Graph represents the workflow as an adjacency list for cycle detection.
type Graph struct {
	adjacency map[string][]string
}

// BuildGraph constructs a graph from the workflow definition.
func BuildGraph(wf *Workflow) *Graph {
	adj := make(map[string][]string, len(wf.Nodes))
	for _, node := range wf.Nodes {
		if _, ok := adj[node.ID]; !ok {
			adj[node.ID] = nil
		}
	}

	for _, edge := range wf.Edges {
		adj[edge.From] = append(adj[edge.From], edge.To)
	}

	return &Graph{adjacency: adj}
}