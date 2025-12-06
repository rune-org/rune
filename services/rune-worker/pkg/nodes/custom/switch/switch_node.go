package switchnode

import (
	"context"
	"fmt"
	"log/slog"

	"rune-worker/pkg/core"
	"rune-worker/pkg/nodes"
	"rune-worker/plugin"
)

// Rule defines a single routing rule.
type Rule struct {
	Value    string      `json:"value"`
	Operator string      `json:"operator"`
	Compare  interface{} `json:"compare"`
}

// SwitchNode routes data based on a set of rules.
type SwitchNode struct {
	rules []Rule
	input map[string]interface{}
}

// NewSwitchNode creates a new SwitchNode instance.
func NewSwitchNode(execCtx plugin.ExecutionContext) *SwitchNode {
	node := &SwitchNode{
		input: execCtx.Input,
		rules: make([]Rule, 0),
	}

	// Parse rules parameter
	if rulesParam, ok := execCtx.Parameters["rules"].([]interface{}); ok {
		for _, r := range rulesParam {
			ruleMap, ok := r.(map[string]interface{})
			if !ok {
				continue
			}
			rule := Rule{}
			if val, ok := ruleMap["value"].(string); ok {
				rule.Value = val
			} else if val, exists := ruleMap["value"]; exists {
				// Preserve already-resolved values (e.g., after parameter resolution)
				rule.Value = fmt.Sprintf("%v", val)
			}
			if op, ok := ruleMap["operator"].(string); ok {
				rule.Operator = op
			}
			if cmp, ok := ruleMap["compare"]; ok {
				rule.Compare = cmp
			}
			node.rules = append(node.rules, rule)
		}
	}

	return node
}

// Execute evaluates the rules and returns the index of the matching rule.
func (n *SwitchNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	evaluator := NewEvaluator(n.input)

	for i, rule := range n.rules {
		match, err := evaluator.EvaluateRule(rule.Value, rule.Operator, rule.Compare)
		if err != nil {
			slog.Warn("failed to evaluate rule", "index", i, "error", err)
			continue
		}

		if match {
			return map[string]any{
				"output_index": i,
				"matched_rule": rule,
			}, nil
		}
	}

	// No match found, return fallback index (len(rules))
	return map[string]any{
		"output_index": len(n.rules),
		"fallback":     true,
	}, nil
}

func init() {
	nodes.RegisterNodeType(RegisterSwitch)
}

// RegisterSwitch registers the switch node type.
func RegisterSwitch(reg *nodes.Registry) {
	reg.Register(core.NodeTypeSwitch, func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewSwitchNode(execCtx)
	})
}
