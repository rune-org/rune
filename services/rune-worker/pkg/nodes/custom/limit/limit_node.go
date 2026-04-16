package limitnode

import (
	"context"
	"fmt"

	"rune-worker/pkg/nodes"
	"rune-worker/pkg/nodes/shared/listops"
	"rune-worker/plugin"
)

type LimitNode struct {
	inputArray any
	count      int
	hasCount   bool
}

func NewLimitNode(execCtx plugin.ExecutionContext) *LimitNode {
	node := &LimitNode{inputArray: execCtx.Parameters["input_array"]}
	if count, ok := listops.ToInt(execCtx.Parameters["count"]); ok {
		node.count = count
		node.hasCount = true
	}
	return node
}

func (n *LimitNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	_ = ctx
	if !n.hasCount {
		return nil, fmt.Errorf("count parameter is required")
	}
	if n.count < 0 {
		return nil, fmt.Errorf("count must be zero or greater")
	}

	items, err := listops.ResolveArrayInput(execCtx.Input, n.inputArray)
	if err != nil {
		return nil, err
	}

	limited := listops.CloneSlice(items)
	if n.count < len(limited) {
		limited = limited[:n.count]
	}

	return map[string]any{
		"$json":          limited,
		"count":          len(limited),
		"original_count": len(items),
	}, nil
}

func init() {
	nodes.RegisterNodeType(RegisterLimit)
}

func RegisterLimit(reg *nodes.Registry) {
	reg.Register("limit", func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewLimitNode(execCtx)
	})
}
