package editnode

import (
	"context"
	"reflect"
	"testing"

	"rune-worker/plugin"
)

func TestEditNodeAssignments(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{"first": "John", "last": "Doe"},
		},
		Parameters: map[string]any{
			"mode": "assignments",
			"assignments": []any{
				map[string]any{"name": "full_name", "value": "{{ $json.first + ' ' + $json.last }}", "type": "string"},
				map[string]any{"name": "active", "value": "true", "type": "boolean"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	if got := payload["full_name"]; got != "John Doe" {
		t.Fatalf("full_name mismatch: %v", got)
	}
	if got := payload["active"]; got != true {
		t.Fatalf("active mismatch: %v", got)
	}
}

func TestEditNodeKeepOnly(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{"first": "Jane", "role": "admin"},
		},
		Parameters: map[string]any{
			"mode": "keep_only",
			"assignments": []any{
				map[string]any{"name": "first", "value": "{{ $json.first }}", "type": "string"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)
	expect := map[string]any{"first": "Jane"}
	if !reflect.DeepEqual(payload, expect) {
		t.Fatalf("unexpected output: %+v", payload)
	}
}

func TestEditNodeNestedSet(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{"order_id": "1"},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "shipping.address.city", "value": "Cairo", "type": "string"},
				map[string]any{"name": "totals.tax", "value": "{{ 5 * 2 }}", "type": "number"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	shipping := payload["shipping"].(map[string]any)
	address := shipping["address"].(map[string]any)
	if address["city"] != "Cairo" {
		t.Fatalf("city mismatch: %v", address["city"])
	}

	totals := payload["totals"].(map[string]any)
	if totals["tax"] != float64(10) {
		t.Fatalf("tax mismatch: %v", totals["tax"])
	}
}
