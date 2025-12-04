package plugin

import (
	"context"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
)

// ExecutionContext provides runtime information and secure access to resources
// for nodes during workflow execution. It contains the workflow and node identifiers,
// input payload from previous nodes, node-specific parameters, and resolved credentials.
//
// The context is passed to each node's Execute method and provides a scoped view of
// the execution environment, ensuring nodes only access data relevant to their execution.
type ExecutionContext struct {
	ExecutionID  string
	WorkflowID   string
	NodeID       string
	Type         string
	Parameters   map[string]any
	Input        map[string]any
	FromNode     string
	credentials  map[string]any
	RedisClient  interface{}
	LineageStack []messages.StackFrame
	Workflow     core.Workflow
}

// GetCredentials returns a read-only copy of the resolved credentials for this node.
// Credentials are securely resolved before execution and contain sensitive data such as
// API keys, passwords, and tokens required for the node's operation.
//
// Returns an empty map if no credentials are configured for this node.
// The returned map is a shallow copy to prevent external modification of credential data.
func (ec *ExecutionContext) GetCredentials() map[string]any {
	if ec.credentials == nil {
		return map[string]any{}
	}

	// Return a shallow copy to prevent external modification
	creds := make(map[string]any, len(ec.credentials))
	for k, v := range ec.credentials {
		creds[k] = v
	}
	return creds
}

// SetCredentials sets the resolved credentials for this execution context.
// This method is intended for internal use by the executor when preparing
// the context before node execution.
func (ec *ExecutionContext) SetCredentials(creds map[string]any) {
	ec.credentials = creds
}

// Node represents a single executable unit within a workflow.
// Implementations of this interface define custom behavior for different node types
// (e.g., HTTP requests, email sending, conditional branching, data transformation).
// Each node receives an ExecutionContext containing input data, parameters, and credentials,
// and produces output data that flows to subsequent nodes in the workflow graph.
type Node interface {
	// Execute runs the node's logic with the provided context and execution environment.
	//
	// Parameters:
	//   - ctx: The Go context for cancellation, timeouts, and deadline propagation.
	//   - execCtx: The execution context containing input data, parameters, and credentials.
	//
	// Returns:
	//   - map[string]any: Output data to be passed to subsequent nodes. The structure
	//     depends on the node type (e.g., HTTP nodes return status, body, headers).
	//   - error: Any error encountered during execution. Errors trigger workflow error
	//     handling based on the node's error configuration (halt, ignore, or branch).
	//
	// Example output structure for an HTTP node:
	//   {
	//     "status": 200,
	//     "body": {"data": "response content"},
	//     "headers": {"content-type": "application/json"}
	//   }
	Execute(ctx context.Context, execCtx ExecutionContext) (map[string]any, error)
}
