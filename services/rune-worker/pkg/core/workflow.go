package core

import dsl "rune-worker/pkg/dsl_generated"



// Re-export generated types via aliases.
// Since methods were added to the dsl package, we can use aliases to keep literals working.
type Workflow = dsl.Workflow
type Node = dsl.Node
type Edge = dsl.Edge
type Credential = dsl.Credential
type ErrorHandling = dsl.ErrorHandling

// Re-export helper functions that were previously methods on Node
func NodeHasCredentials(n dsl.Node) bool {
	return n.Credentials != nil && n.Credentials.ID != ""
}

func NodeHasErrorHandling(n dsl.Node) bool {
	return n.Error != nil && n.Error.Type != ""
}
