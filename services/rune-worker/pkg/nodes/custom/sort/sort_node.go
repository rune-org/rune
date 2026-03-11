package sortnode

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"rune-worker/pkg/nodes"
	"rune-worker/pkg/nodes/shared/listops"
	"rune-worker/plugin"
)

type SortRule struct {
	Field     string
	Direction string
	Type      string
}

type SortNode struct {
	inputArray any
	rules      []SortRule
}

func NewSortNode(execCtx plugin.ExecutionContext) *SortNode {
	node := &SortNode{inputArray: execCtx.Parameters["input_array"]}
	if rawRules, ok := execCtx.Parameters["rules"].([]any); ok {
		for _, raw := range rawRules {
			ruleMap, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			node.rules = append(node.rules, SortRule{
				Field:     listops.StringValue(ruleMap["field"]),
				Direction: strings.ToLower(strings.TrimSpace(listops.StringValue(ruleMap["direction"]))),
				Type:      strings.ToLower(strings.TrimSpace(listops.StringValue(ruleMap["type"]))),
			})
		}
	}
	return node
}

func (n *SortNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	_ = ctx
	if len(n.rules) == 0 {
		return nil, fmt.Errorf("at least one sort rule is required")
	}

	items, err := listops.ResolveArrayInput(execCtx.Input, n.inputArray)
	if err != nil {
		return nil, err
	}

	sorted := listops.CloneSlice(items)
	var sortErr error
	sort.SliceStable(sorted, func(i, j int) bool {
		result, cmpErr := n.less(sorted[i], sorted[j])
		if cmpErr != nil {
			sortErr = cmpErr
			return false
		}
		return result
	})
	if sortErr != nil {
		return nil, sortErr
	}

	return map[string]any{
		"$json": sorted,
		"count": len(sorted),
	}, nil
}

func (n *SortNode) less(leftItem, rightItem any) (bool, error) {
	for _, rule := range n.rules {
		left, leftErr := listops.GetFieldValue(leftItem, rule.Field)
		right, rightErr := listops.GetFieldValue(rightItem, rule.Field)
		if leftErr != nil {
			left = nil
		}
		if rightErr != nil {
			right = nil
		}
		cmp, err := listops.CompareForSort(left, right, rule.Type)
		if err != nil {
			return false, err
		}
		if cmp == 0 {
			continue
		}
		if rule.Direction == "desc" || rule.Direction == "descending" {
			return cmp > 0, nil
		}
		return cmp < 0, nil
	}
	return false, nil
}

func init() {
	nodes.RegisterNodeType(RegisterSort)
}

func RegisterSort(reg *nodes.Registry) {
	reg.Register("sort", func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewSortNode(execCtx)
	})
}
