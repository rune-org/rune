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

func TestEditNode_StaticValueAssignment(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{"id": "123"},
		},
		Parameters: map[string]any{
			"mode": "assignments",
			"assignments": []any{
				map[string]any{"name": "status", "value": "active", "type": "string"},
				map[string]any{"name": "count", "value": "42", "type": "number"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	if payload["status"] != "active" {
		t.Errorf("Expected status 'active', got %v", payload["status"])
	}
	if payload["count"] != float64(42) {
		t.Errorf("Expected count 42, got %v", payload["count"])
	}
	// Original field should be preserved
	if payload["id"] != "123" {
		t.Errorf("Expected id '123', got %v", payload["id"])
	}
}

func TestEditNode_AccessPreviousNode(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{"order_id": "ORD-123", "total": float64(100)},
			"$http_fetch_rates": map[string]any{
				"body": map[string]any{
					"tax_rate": float64(0.15),
					"currency": "EGP",
				},
			},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "tax_amount", "value": "{{ $json.total * $http_fetch_rates.body.tax_rate }}", "type": "number"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	if payload["tax_amount"] != float64(15) {
		t.Errorf("Expected tax_amount 15, got %v", payload["tax_amount"])
	}
}

func TestEditNode_MultipleNestedPaths(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{
				"shipping": map[string]any{
					"street": "123 Main St",
					"city":   "Cairo",
				},
			},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "shipping.full_address", "value": "{{ $json.shipping.street + ', ' + $json.shipping.city }}", "type": "string"},
				map[string]any{"name": "shipping.country", "value": "Egypt", "type": "string"},
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

	if shipping["full_address"] != "123 Main St, Cairo" {
		t.Errorf("Expected full_address '123 Main St, Cairo', got %v", shipping["full_address"])
	}
	if shipping["country"] != "Egypt" {
		t.Errorf("Expected country 'Egypt', got %v", shipping["country"])
	}
	// Original fields should be preserved
	if shipping["street"] != "123 Main St" {
		t.Errorf("Expected street '123 Main St', got %v", shipping["street"])
	}
}

func TestEditNode_NumberCasting(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "int_val", "value": "{{ 10 + 5 }}", "type": "number"},
				map[string]any{"name": "float_val", "value": "{{ 3.14 * 2 }}", "type": "number"},
				map[string]any{"name": "string_to_num", "value": "99.5", "type": "number"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	if payload["int_val"] != float64(15) {
		t.Errorf("Expected int_val 15, got %v", payload["int_val"])
	}
	if payload["float_val"] != float64(6.28) {
		t.Errorf("Expected float_val 6.28, got %v", payload["float_val"])
	}
	if payload["string_to_num"] != float64(99.5) {
		t.Errorf("Expected string_to_num 99.5, got %v", payload["string_to_num"])
	}
}

func TestEditNode_BooleanCasting(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "bool_true", "value": "true", "type": "boolean"},
				map[string]any{"name": "bool_false", "value": "false", "type": "boolean"},
				map[string]any{"name": "bool_yes", "value": "yes", "type": "boolean"},
				map[string]any{"name": "bool_no", "value": "no", "type": "boolean"},
				map[string]any{"name": "bool_one", "value": "1", "type": "boolean"},
				map[string]any{"name": "bool_zero", "value": "0", "type": "boolean"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	if payload["bool_true"] != true {
		t.Errorf("Expected bool_true true, got %v", payload["bool_true"])
	}
	if payload["bool_false"] != false {
		t.Errorf("Expected bool_false false, got %v", payload["bool_false"])
	}
	if payload["bool_yes"] != true {
		t.Errorf("Expected bool_yes true, got %v", payload["bool_yes"])
	}
	if payload["bool_no"] != false {
		t.Errorf("Expected bool_no false, got %v", payload["bool_no"])
	}
	if payload["bool_one"] != true {
		t.Errorf("Expected bool_one true, got %v", payload["bool_one"])
	}
	if payload["bool_zero"] != false {
		t.Errorf("Expected bool_zero false, got %v", payload["bool_zero"])
	}
}

func TestEditNode_JSONCasting(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "array", "value": `[1, 2, 3]`, "type": "json"},
				map[string]any{"name": "object", "value": `{"key": "value"}`, "type": "json"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	arr := payload["array"].([]any)
	if len(arr) != 3 {
		t.Errorf("Expected array length 3, got %d", len(arr))
	}
	if arr[0] != float64(1) {
		t.Errorf("Expected array[0] 1, got %v", arr[0])
	}

	obj := payload["object"].(map[string]any)
	if obj["key"] != "value" {
		t.Errorf("Expected object.key 'value', got %v", obj["key"])
	}
}

func TestEditNode_EmptyJsonInput(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "status", "value": "initialized", "type": "string"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	if payload["status"] != "initialized" {
		t.Errorf("Expected status 'initialized', got %v", payload["status"])
	}
}

func TestEditNode_NoAssignments(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{"id": "123"},
		},
		Parameters: map[string]any{},
	}

	node := NewEditNode(execCtx)
	_, err := node.Execute(context.Background(), execCtx)
	if err == nil {
		t.Error("Expected error for missing assignments")
	}
}

func TestEditNode_EmptyAssignmentName(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "", "value": "test", "type": "string"},
			},
		},
	}

	node := NewEditNode(execCtx)
	_, err := node.Execute(context.Background(), execCtx)
	if err == nil {
		t.Error("Expected error for empty assignment name")
	}
}

func TestEditNode_InvalidNumberCast(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "bad_number", "value": "hello", "type": "number"},
			},
		},
	}

	node := NewEditNode(execCtx)
	_, err := node.Execute(context.Background(), execCtx)
	if err == nil {
		t.Error("Expected error for invalid number cast")
	}
}

func TestEditNode_ExpressionWithMathOperations(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{
				"quantity":   float64(5),
				"unit_price": float64(10.50),
			},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "subtotal", "value": "{{ $json.quantity * $json.unit_price }}", "type": "number"},
				map[string]any{"name": "tax", "value": "{{ $json.quantity * $json.unit_price * 0.1 }}", "type": "number"},
				map[string]any{"name": "total", "value": "{{ $json.quantity * $json.unit_price * 1.1 }}", "type": "number"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	if payload["subtotal"] != float64(52.5) {
		t.Errorf("Expected subtotal 52.5, got %v", payload["subtotal"])
	}
	// Allow for floating point imprecision
	tax := payload["tax"].(float64)
	if tax < 5.24 || tax > 5.26 {
		t.Errorf("Expected tax ~5.25, got %v", tax)
	}
}

func TestEditNode_KeepOnlyMultipleFields(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{
				"id":       "123",
				"email":    "test@example.com",
				"password": "secret",
				"role":     "admin",
				"created":  "2024-01-01",
			},
		},
		Parameters: map[string]any{
			"mode": "keep_only",
			"assignments": []any{
				map[string]any{"name": "id", "value": "{{ $json.id }}", "type": "string"},
				map[string]any{"name": "email", "value": "{{ $json.email }}", "type": "string"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	// Should only have id and email
	if len(payload) != 2 {
		t.Errorf("Expected 2 fields, got %d: %+v", len(payload), payload)
	}
	if payload["id"] != "123" {
		t.Errorf("Expected id '123', got %v", payload["id"])
	}
	if payload["email"] != "test@example.com" {
		t.Errorf("Expected email 'test@example.com', got %v", payload["email"])
	}
	// password, role, created should be removed
	if _, exists := payload["password"]; exists {
		t.Error("password should not exist in keep_only mode")
	}
}

func TestEditNode_StringConcatenation(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{
				"first_name": "John",
				"last_name":  "Smith",
				"title":      "Mr.",
			},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "full_name", "value": "{{ $json.title + ' ' + $json.first_name + ' ' + $json.last_name }}", "type": "string"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	if payload["full_name"] != "Mr. John Smith" {
		t.Errorf("Expected full_name 'Mr. John Smith', got %v", payload["full_name"])
	}
}

func TestEditNode_OverwriteExistingField(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{
				"status": "pending",
			},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "status", "value": "completed", "type": "string"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	if payload["status"] != "completed" {
		t.Errorf("Expected status 'completed', got %v", payload["status"])
	}
}

func TestEditNode_DeepNestedPath(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "a.b.c.d.e", "value": "deep_value", "type": "string"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	// Navigate to deep value
	a := payload["a"].(map[string]any)
	b := a["b"].(map[string]any)
	c := b["c"].(map[string]any)
	d := c["d"].(map[string]any)

	if d["e"] != "deep_value" {
		t.Errorf("Expected deep value 'deep_value', got %v", d["e"])
	}
}

func TestEditNode_PreservesOriginalOnError(t *testing.T) {
	// When assignment fails, original input should not be modified
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{
				"original": "value",
			},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "bad", "value": "not_a_number", "type": "number"},
			},
		},
	}

	node := NewEditNode(execCtx)
	_, err := node.Execute(context.Background(), execCtx)
	if err == nil {
		t.Fatal("Expected error")
	}

	// Verify original input wasn't modified
	original := execCtx.Input["$json"].(map[string]any)
	if original["original"] != "value" {
		t.Error("Original input was modified on error")
	}
}

func TestEditNode_ExpressionWithJSFunctions(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{
				"name": "John Doe",
			},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "upper_name", "value": "{{ $json.name.toUpperCase() }}", "type": "string"},
				map[string]any{"name": "lower_name", "value": "{{ $json.name.toLowerCase() }}", "type": "string"},
				map[string]any{"name": "name_length", "value": "{{ $json.name.length }}", "type": "number"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	if payload["upper_name"] != "JOHN DOE" {
		t.Errorf("Expected upper_name 'JOHN DOE', got %v", payload["upper_name"])
	}
	if payload["lower_name"] != "john doe" {
		t.Errorf("Expected lower_name 'john doe', got %v", payload["lower_name"])
	}
	if payload["name_length"] != float64(8) {
		t.Errorf("Expected name_length 8, got %v", payload["name_length"])
	}
}

func TestEditNode_DefaultTypeIsString(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "field", "value": "123"},
				// Note: no type specified, should default to string
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	if payload["field"] != "123" {
		t.Errorf("Expected field '123' as string, got %v (%T)", payload["field"], payload["field"])
	}
}

func TestEditNode_TernaryExpression(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{
				"score": float64(85),
			},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "grade", "value": "{{ $json.score >= 80 ? 'A' : 'B' }}", "type": "string"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	if payload["grade"] != "A" {
		t.Errorf("Expected grade 'A', got %v", payload["grade"])
	}
}

func TestEditNode_ComplexWorkflowContext(t *testing.T) {
	// Simulate a complex workflow context with multiple previous node outputs
	execCtx := plugin.ExecutionContext{
		Input: map[string]any{
			"$json": map[string]any{
				"user_id": "U123",
			},
			"$http_node": map[string]any{
				"status_code": float64(200),
				"body": map[string]any{
					"data": map[string]any{
						"name":  "Test User",
						"email": "test@example.com",
					},
				},
			},
			"$prevNode": map[string]any{
				"result": "success",
			},
		},
		Parameters: map[string]any{
			"assignments": []any{
				map[string]any{"name": "user_name", "value": "{{ $http_node.body.data.name }}", "type": "string"},
				map[string]any{"name": "user_email", "value": "{{ $http_node.body.data.email }}", "type": "string"},
				map[string]any{"name": "prev_result", "value": "{{ $prevNode.result }}", "type": "string"},
				map[string]any{"name": "http_status", "value": "{{ $http_node.status_code }}", "type": "number"},
			},
		},
	}

	node := NewEditNode(execCtx)
	out, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	payload := out["$json"].(map[string]any)

	if payload["user_name"] != "Test User" {
		t.Errorf("Expected user_name 'Test User', got %v", payload["user_name"])
	}
	if payload["user_email"] != "test@example.com" {
		t.Errorf("Expected user_email 'test@example.com', got %v", payload["user_email"])
	}
	if payload["prev_result"] != "success" {
		t.Errorf("Expected prev_result 'success', got %v", payload["prev_result"])
	}
	if payload["http_status"] != float64(200) {
		t.Errorf("Expected http_status 200, got %v", payload["http_status"])
	}
}

func TestNewEditNode_ParsesParameters(t *testing.T) {
	tests := []struct {
		name        string
		params      map[string]any
		expectMode  string
		expectCount int
	}{
		{
			name: "default mode",
			params: map[string]any{
				"assignments": []any{
					map[string]any{"name": "a", "value": "b"},
				},
			},
			expectMode:  modeAssignments,
			expectCount: 1,
		},
		{
			name: "keep_only mode",
			params: map[string]any{
				"mode": "keep_only",
				"assignments": []any{
					map[string]any{"name": "a", "value": "b"},
					map[string]any{"name": "c", "value": "d"},
				},
			},
			expectMode:  modeKeepOnly,
			expectCount: 2,
		},
		{
			name: "empty assignments",
			params: map[string]any{
				"assignments": []any{},
			},
			expectMode:  modeAssignments,
			expectCount: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			execCtx := plugin.ExecutionContext{
				Input:      map[string]any{},
				Parameters: tt.params,
			}

			node := NewEditNode(execCtx)

			if node.mode != tt.expectMode {
				t.Errorf("Expected mode %s, got %s", tt.expectMode, node.mode)
			}
			if len(node.assignments) != tt.expectCount {
				t.Errorf("Expected %d assignments, got %d", tt.expectCount, len(node.assignments))
			}
		})
	}
}
