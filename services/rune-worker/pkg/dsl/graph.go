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

// HasCycle performs a DFS to detect cycles in the graph.
func (g *Graph) HasCycle() bool {
	visited := make(map[string]bool, len(g.adjacency))
	stack := make(map[string]bool, len(g.adjacency))

	var visit func(string) bool
	visit = func(node string) bool {
		if stack[node] {
			return true
		}
		if visited[node] {
			return false
		}

		visited[node] = true
		stack[node] = true

		for _, neighbor := range g.adjacency[node] {
			if visit(neighbor) {
				return true
			}
		}

		stack[node] = false
		return false
	}

	for node := range g.adjacency {
		if visit(node) {
			return true
		}
	}

	return false
}
