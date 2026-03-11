package filternode

import (
	"context"
	"fmt"
	"strings"

	"rune-worker/pkg/nodes"
	"rune-worker/pkg/nodes/shared/listops"
	"rune-worker/plugin"
)

type Rule struct {
	Field    string
	Operator string
	Value    any
}

type FilterNode struct {
	inputArray any
	rules      []Rule
	matchMode  string
}

func NewFilterNode(execCtx plugin.ExecutionContext) *FilterNode {
	node := &FilterNode{inputArray: execCtx.Parameters["input_array"], matchMode: "all"}
	if mode, ok := execCtx.Parameters["match_mode"].(string); ok && strings.TrimSpace(mode) != "" {
		node.matchMode = strings.ToLower(strings.TrimSpace(mode))
	}
	if rawRules, ok := execCtx.Parameters["rules"].([]any); ok {
		node.rules = parseRules(rawRules)
	}
	return node
}

func parseRules(rawRules []any) []Rule {
	rules := make([]Rule, 0, len(rawRules))
	for _, raw := range rawRules {
		ruleMap, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		rules = append(rules, Rule{
			Field:    listops.StringValue(ruleMap["field"]),
			Operator: listops.StringValue(ruleMap["operator"]),
			Value:    listops.ParseComparable(ruleMap["value"]),
		})
	}
	return rules
}

func (n *FilterNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	_ = ctx
	if len(n.rules) == 0 {
		return nil, fmt.Errorf("at least one filter rule is required")
	}

	items, err := listops.ResolveArrayInput(execCtx.Input, n.inputArray)
	if err != nil {
		return nil, err
	}

	filtered := make([]any, 0, len(items))
	for _, item := range items {
		matched, err := n.matches(item)
		if err != nil {
			return nil, err
		}
		if matched {
			filtered = append(filtered, item)
		}
	}

	return map[string]any{
		"$json":          filtered,
		"count":          len(filtered),
		"original_count": len(items),
	}, nil
}

func (n *FilterNode) matches(item any) (bool, error) {
	matchedAny := false
	for _, rule := range n.rules {
		left, err := listops.GetFieldValue(item, rule.Field)
		if err != nil {
			if n.matchMode == "all" {
				return false, nil
			}
			continue
		}
		result, err := listops.CompareValues(left, rule.Value, rule.Operator)
		if err != nil {
			return false, err
		}
		if n.matchMode == "any" {
			if result {
				return true, nil
			}
			continue
		}
		if !result {
			return false, nil
		}
		matchedAny = true
	}
	if n.matchMode == "any" {
		return matchedAny, nil
	}
	return matchedAny || len(n.rules) == 0, nil
}
func init() {
	nodes.RegisterNodeType(RegisterFilter)
}

func RegisterFilter(reg *nodes.Registry) {
	reg.Register("filter", func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewFilterNode(execCtx)
	})
}
