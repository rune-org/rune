package editnode

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"time"

	"github.com/dop251/goja"

	"rune-worker/pkg/nodes"
	"rune-worker/plugin"
)

const (
	modeAssignments = "assignments"
	modeKeepOnly    = "keep_only"
)

// Assignment represents a single transformation operation.
type Assignment struct {
	Name  string
	Value string
	Type  string
}

// EditNode implements the edit/set/transform node described in RFC-007.
type EditNode struct {
	mode        string
	assignments []Assignment
	input       map[string]any
}

// NewEditNode builds an EditNode from execution context parameters.
func NewEditNode(execCtx plugin.ExecutionContext) *EditNode {
	node := &EditNode{
		mode:        modeAssignments,
		assignments: make([]Assignment, 0),
		input:       execCtx.Input,
	}

	if m, ok := execCtx.Parameters["mode"].(string); ok && m != "" {
		node.mode = strings.ToLower(m)
	}

	if rawAssignments, ok := execCtx.Parameters["assignments"].([]any); ok {
		for _, item := range rawAssignments {
			if asMap, ok := item.(map[string]any); ok {
				assignment := Assignment{}
				if name, ok := asMap["name"].(string); ok {
					assignment.Name = name
				}
				if val, ok := asMap["value"].(string); ok {
					assignment.Value = val
				}
				if t, ok := asMap["type"].(string); ok {
					assignment.Type = strings.ToLower(t)
				} else {
					assignment.Type = "string"
				}

				node.assignments = append(node.assignments, assignment)
			}
		}
	}

	return node
}

// Execute applies transformations and returns the updated payload.
func (n *EditNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	if len(n.assignments) == 0 {
		return nil, fmt.Errorf("assignments are required")
	}

	basePayload, _ := n.input["$json"].(map[string]any)
	if basePayload == nil {
		basePayload = make(map[string]any)
	}

	outputPayload, err := DeepCopyMap(basePayload)
	if err != nil {
		return nil, fmt.Errorf("deep copy payload: %w", err)
	}

	if n.mode == modeKeepOnly {
		outputPayload = make(map[string]any)
	}

	for _, assignment := range n.assignments {
		if assignment.Name == "" {
			return nil, fmt.Errorf("assignment name is required")
		}

		resolved, err := n.resolveValue(ctx, assignment.Value)
		if err != nil {
			return nil, fmt.Errorf("resolve value for '%s': %w", assignment.Name, err)
		}

		casted, err := TypeCast(resolved, assignment.Type)
		if err != nil {
			return nil, fmt.Errorf("type cast for '%s': %w", assignment.Name, err)
		}

		if err := SetNested(outputPayload, assignment.Name, casted); err != nil {
			return nil, fmt.Errorf("set nested for '%s': %w", assignment.Name, err)
		}
	}

	return map[string]any{"$json": outputPayload}, nil
}

var exprPattern = regexp.MustCompile(`^\s*\{\{(.+)\}\}\s*$`)

func (n *EditNode) resolveValue(ctx context.Context, raw string) (any, error) {
	m := exprPattern.FindStringSubmatch(raw)
	if len(m) == 0 {
		return raw, nil
	}

	expr := strings.TrimSpace(m[1])
	return n.evaluateExpression(ctx, expr)
}

func (n *EditNode) evaluateExpression(parentCtx context.Context, expr string) (any, error) {
	vm := goja.New()

	// Inject accumulated context as globals (e.g., $json, $prevNode)
	for k, v := range n.input {
		if err := vm.Set(k, v); err != nil {
			slog.Warn("failed to inject variable into JS runtime", "key", k, "error", err)
		}
	}

	// Timeout guard
	ctx, cancel := context.WithTimeout(parentCtx, 100*time.Millisecond)
	defer cancel()

	type result struct {
		val any
		err error
	}

	done := make(chan result, 1)
	go func() {
		value, err := vm.RunString(expr)
		if err != nil {
			done <- result{nil, err}
			return
		}
		done <- result{value.Export(), nil}
	}()

	select {
	case <-ctx.Done():
		return nil, fmt.Errorf("expression timeout or cancelled")
	case res := <-done:
		return res.val, res.err
	}
}

func init() {
	nodes.RegisterNodeType(RegisterEdit)
}

// RegisterEdit registers the edit node type.
func RegisterEdit(reg *nodes.Registry) {
	reg.Register("edit", func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewEditNode(execCtx)
	})
}
