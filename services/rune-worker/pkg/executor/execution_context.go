package executor

import (
	"fmt"
	"log/slog"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/resolver"
	"rune-worker/plugin"
)

// buildExecutionContext creates the plugin.ExecutionContext from the message.
// Credentials are already resolved by the master service and included in the node definition.
// Parameters are resolved using the resolver to handle dynamic references like $node.field.
// It also returns the list of input keys used during parameter resolution.
func (e *Executor) buildExecutionContext(msg *messages.NodeExecutionMessage, node *core.Node) (plugin.ExecutionContext, []string) {
	// Resolve dynamic parameter references before execution
	resolvedParams := node.Parameters
	var usedKeys []string
	if len(node.Parameters) > 0 && msg.AccumulatedContext != nil {
		r := resolver.NewResolver(msg.AccumulatedContext)
		if params, err := r.ResolveParameters(node.Parameters); err == nil {
			resolvedParams = params
			usedKeys = r.GetUsedKeys()
		} else {
			slog.Warn("failed to resolve parameters, using original values",
				"error", err,
				"node_id", node.ID,
			)
		}
	}

	execCtx := plugin.ExecutionContext{
		ExecutionID:  msg.ExecutionID,
		WorkflowID:   msg.WorkflowID,
		NodeID:       node.ID,
		Type:         node.Type,
		Parameters:   resolvedParams,
		Input:        msg.AccumulatedContext,
		FromNode:     msg.FromNode,
		RedisClient:  e.redisClient,
		LineageStack: msg.LineageStack,
		Workflow:     msg.WorkflowDefinition,
	}

	// Set credentials if present (already resolved by master)
	if node.Credentials != nil && node.Credentials.Values != nil {
		creds := node.Credentials.Values
		creds["type"] = node.Credentials.Type
		execCtx.SetCredentials(creds)
	}

	return execCtx, usedKeys
}

// filterUsedInputs extracts only the input entries that were referenced during parameter resolution.
func (e *Executor) filterUsedInputs(input map[string]any, usedKeys []string) map[string]any {
	if len(usedKeys) == 0 || len(input) == 0 {
		return nil
	}

	filtered := make(map[string]any)
	for _, key := range usedKeys {
		if val, ok := input[key]; ok {
			filtered[key] = val
		}
	}
	return filtered
}

// accumulateContext adds the node output to the accumulated context with $<node_name> key.
func (e *Executor) accumulateContext(currentContext map[string]interface{}, nodeName string, output map[string]any) map[string]interface{} {
	updated := make(map[string]interface{}, len(currentContext)+1)
	for k, v := range currentContext {
		updated[k] = v
	}
	if len(output) == 1 {
		for _, v := range output {
			updated[fmt.Sprintf("$%s", nodeName)] = v
			return updated
		}
	}
	updated[fmt.Sprintf("$%s", nodeName)] = output
	return updated
}
