package conditional

import (
	"context"
	"fmt"

	"rune-worker/pkg/nodes"
	"rune-worker/plugin"
)

// ConditionalNode evaluates a boolean expression and determines the execution path.
// It returns a result field indicating which edge to follow (true or false).
type ConditionalNode struct {
	expression string
	input      map[string]interface{}
}

// NewConditionalNode creates a new ConditionalNode instance from execution context parameters.
func NewConditionalNode(execCtx plugin.ExecutionContext) *ConditionalNode {
	node := &ConditionalNode{
		input: execCtx.Input,
	}

	// Parse expression parameter
	if expr, ok := execCtx.Parameters["expression"].(string); ok {
		node.expression = expr
	}

	return node
}

// Execute evaluates the conditional expression and returns the result.
// Returns a map with a "result" key containing a boolean value.
func (n *ConditionalNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	if n.expression == "" {
		return nil, fmt.Errorf("expression parameter is required")
	}

	// Create evaluator with the input context
	evaluator := NewEvaluator(n.input)

	// Evaluate the expression
	result, err := evaluator.Evaluate(n.expression)
	if err != nil {
		return nil, fmt.Errorf("expression evaluation failed: %w", err)
	}

	// Return the result
	return map[string]any{
		"result":     result,
		"expression": n.expression,
	}, nil
}

func init() {
	nodes.RegisterNodeType(RegisterConditional)
}

// RegisterConditional registers the conditional node type with the registry.
func RegisterConditional(reg *nodes.Registry) {
	reg.Register("conditional", func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewConditionalNode(execCtx)
	})
}
