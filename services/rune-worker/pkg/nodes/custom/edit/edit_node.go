package editnode

import (
	"context"
	"errors"
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
	evalTimeout     = 100 * time.Millisecond
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
	targetPath  string
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

	if tp, ok := execCtx.Parameters["target_path"].(string); ok && tp != "" {
		node.targetPath = tp
	} else if ap, ok := execCtx.Parameters["array_path"].(string); ok && ap != "" {
		node.targetPath = ap
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

	var sourceData any
	if n.targetPath != "" {
		var err error
		sourceData, err = GetNested(n.input, n.targetPath)
		if err != nil {
			// Accumulated context keys are commonly prefixed with '$' (for example "$json" or "$node").
			// Allow target_path to omit the root '$' for compatibility with existing workflows.
			altPath := withDollarRoot(n.targetPath)
			if altPath != n.targetPath {
				sourceData, err = GetNested(n.input, altPath)
			}
			if err != nil {
				return nil, fmt.Errorf("get target path '%s': %w", n.targetPath, err)
			}
		}
	} else {
		sourceData = n.input["$json"]
	}

	if sourceData == nil {
		if n.targetPath == "" {
			sourceData = make(map[string]any)
		} else {
			return nil, fmt.Errorf("target path '%s' resolved to nil", n.targetPath)
		}
	}

	switch src := sourceData.(type) {
	case map[string]any:
		outputPayload, err := DeepCopyMap(src)
		if err != nil {
			return nil, fmt.Errorf("deep copy payload: %w", err)
		}

		if n.mode == modeKeepOnly {
			outputPayload = make(map[string]any)
		}

		overrides := map[string]any{}
		if n.targetPath != "" {
			overrides["$json"] = src
		}

		if err := n.applyAssignments(ctx, outputPayload, overrides); err != nil {
			return nil, err
		}

		return map[string]any{"$json": outputPayload}, nil

	case []any:
		result := make([]any, 0, len(src))
		for i, item := range src {
			m, ok := item.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("item at index %d is not a map", i)
			}

			outputPayload, err := DeepCopyMap(m)
			if err != nil {
				return nil, fmt.Errorf("deep copy item %d: %w", i, err)
			}

			if n.mode == modeKeepOnly {
				outputPayload = make(map[string]any)
			}

			overrides := map[string]any{"$json": m}

			if err := n.applyAssignments(ctx, outputPayload, overrides); err != nil {
				return nil, fmt.Errorf("apply assignments at index %d: %w", i, err)
			}
			result = append(result, outputPayload)
		}

		return map[string]any{"$json": result}, nil

	default:
		return nil, fmt.Errorf("target data is neither map nor array")
	}
}

func (n *EditNode) applyAssignments(ctx context.Context, payload map[string]any, overrides map[string]any) error {
	for _, assignment := range n.assignments {
		if assignment.Name == "" {
			return fmt.Errorf("assignment name is required")
		}

		resolved, err := n.resolveValue(ctx, assignment.Value, overrides)
		if err != nil {
			return fmt.Errorf("resolve value for '%s': %w", assignment.Name, err)
		}

		casted, err := TypeCast(resolved, assignment.Type)
		if err != nil {
			return fmt.Errorf("type cast for '%s': %w", assignment.Name, err)
		}

		if err := SetNested(payload, assignment.Name, casted); err != nil {
			return fmt.Errorf("set nested for '%s': %w", assignment.Name, err)
		}
	}
	return nil
}

var exprPattern = regexp.MustCompile(`^\s*\{\{(.+)\}\}\s*$`)

func (n *EditNode) resolveValue(ctx context.Context, raw string, overrides map[string]any) (any, error) {
	m := exprPattern.FindStringSubmatch(raw)
	if len(m) == 0 {
		return raw, nil
	}

	expr := strings.TrimSpace(m[1])
	return n.evaluateExpression(ctx, expr, overrides)
}

func (n *EditNode) evaluateExpression(parentCtx context.Context, expr string, overrides map[string]any) (any, error) {
	vm := goja.New()

	// Inject accumulated context as globals (e.g., $json, $prevNode)
	for k, v := range n.input {
		if err := vm.Set(k, v); err != nil {
			slog.Warn("failed to inject variable into JS runtime", "key", k, "error", err)
		}
	}

	// Inject overrides
	for k, v := range overrides {
		if err := vm.Set(k, v); err != nil {
			slog.Warn("failed to inject override into JS runtime", "key", k, "error", err)
		}
	}

	evalCtx, cancel := context.WithTimeout(parentCtx, evalTimeout)
	defer cancel()

	done := make(chan struct{})
	go func() {
		select {
		case <-evalCtx.Done():
			vm.Interrupt(evalCtx.Err())
		case <-done:
		}
	}()

	value, err := vm.RunString(expr)
	close(done)

	if err != nil {
		var interruptedErr *goja.InterruptedError
		if errors.As(err, &interruptedErr) {
			if errors.Is(evalCtx.Err(), context.DeadlineExceeded) || errors.Is(evalCtx.Err(), context.Canceled) {
				return nil, fmt.Errorf("expression timeout or cancelled")
			}
		}
		return nil, err
	}

	return value.Export(), nil
}

func init() {
	nodes.RegisterNodeType(RegisterEdit)
}

func withDollarRoot(path string) string {
	if path == "" || strings.HasPrefix(path, "$") {
		return path
	}

	parts := strings.SplitN(path, ".", 2)
	if len(parts) == 1 {
		return "$" + parts[0]
	}
	return "$" + parts[0] + "." + parts[1]
}

// RegisterEdit registers the edit node type.
func RegisterEdit(reg *nodes.Registry) {
	reg.Register("edit", func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewEditNode(execCtx)
	})
}
