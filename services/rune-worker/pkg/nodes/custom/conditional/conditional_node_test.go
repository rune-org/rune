package conditional

import (
	"context"
	"testing"

	"rune-worker/plugin"
)

func TestConditionalNode_SimpleTrue(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-1",
		WorkflowID:  "test-workflow-1",
		NodeID:      "conditional-node-1",
		Type:        "conditional",
		Parameters: map[string]any{
			"expression": "true",
		},
		Input: map[string]any{},
	}

	node := NewConditionalNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resultVal, ok := result["result"].(bool); !ok || !resultVal {
		t.Errorf("Expected result true, got %v", result["result"])
	}
}

func TestConditionalNode_SimpleFalse(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-2",
		WorkflowID:  "test-workflow-2",
		NodeID:      "conditional-node-2",
		Type:        "conditional",
		Parameters: map[string]any{
			"expression": "false",
		},
		Input: map[string]any{},
	}

	node := NewConditionalNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resultVal, ok := result["result"].(bool); !ok || resultVal {
		t.Errorf("Expected result false, got %v", result["result"])
	}
}

func TestConditionalNode_EqualityComparison(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-3",
		WorkflowID:  "test-workflow-3",
		NodeID:      "conditional-node-3",
		Type:        "conditional",
		Parameters: map[string]any{
			"expression": "$status == 200",
		},
		Input: map[string]any{
			"$status": 200,
		},
	}

	node := NewConditionalNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resultVal, ok := result["result"].(bool); !ok || !resultVal {
		t.Errorf("Expected result true, got %v", result["result"])
	}
}

func TestConditionalNode_GreaterThan(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-4",
		WorkflowID:  "test-workflow-4",
		NodeID:      "conditional-node-4",
		Type:        "conditional",
		Parameters: map[string]any{
			"expression": "$count > 5",
		},
		Input: map[string]any{
			"$count": 10,
		},
	}

	node := NewConditionalNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resultVal, ok := result["result"].(bool); !ok || !resultVal {
		t.Errorf("Expected result true for 10 > 5, got %v", result["result"])
	}
}

func TestConditionalNode_LessThan(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-5",
		WorkflowID:  "test-workflow-5",
		NodeID:      "conditional-node-5",
		Type:        "conditional",
		Parameters: map[string]any{
			"expression": "$count < 5",
		},
		Input: map[string]any{
			"$count": 3,
		},
	}

	node := NewConditionalNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resultVal, ok := result["result"].(bool); !ok || !resultVal {
		t.Errorf("Expected result true for 3 < 5, got %v", result["result"])
	}
}

func TestConditionalNode_AndOperator(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-6",
		WorkflowID:  "test-workflow-6",
		NodeID:      "conditional-node-6",
		Type:        "conditional",
		Parameters: map[string]any{
			"expression": "$status == 200 and $hasData == true",
		},
		Input: map[string]any{
			"$status":  200,
			"$hasData": true,
		},
	}

	node := NewConditionalNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resultVal, ok := result["result"].(bool); !ok || !resultVal {
		t.Errorf("Expected result true for AND condition, got %v", result["result"])
	}
}

func TestConditionalNode_OrOperator(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-7",
		WorkflowID:  "test-workflow-7",
		NodeID:      "conditional-node-7",
		Type:        "conditional",
		Parameters: map[string]any{
			"expression": "$status == 404 or $status == 500",
		},
		Input: map[string]any{
			"$status": 404,
		},
	}

	node := NewConditionalNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resultVal, ok := result["result"].(bool); !ok || !resultVal {
		t.Errorf("Expected result true for OR condition, got %v", result["result"])
	}
}

func TestConditionalNode_NotOperator(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-8",
		WorkflowID:  "test-workflow-8",
		NodeID:      "conditional-node-8",
		Type:        "conditional",
		Parameters: map[string]any{
			"expression": "not $error",
		},
		Input: map[string]any{
			"$error": false,
		},
	}

	node := NewConditionalNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resultVal, ok := result["result"].(bool); !ok || !resultVal {
		t.Errorf("Expected result true for NOT false, got %v", result["result"])
	}
}

func TestConditionalNode_ContainsOperator(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-9",
		WorkflowID:  "test-workflow-9",
		NodeID:      "conditional-node-9",
		Type:        "conditional",
		Parameters: map[string]any{
			"expression": "$message contains 'success'",
		},
		Input: map[string]any{
			"$message": "operation completed successfully",
		},
	}

	node := NewConditionalNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resultVal, ok := result["result"].(bool); !ok || !resultVal {
		t.Errorf("Expected result true for contains operator, got %v", result["result"])
	}
}

func TestConditionalNode_NestedFieldAccess(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-10",
		WorkflowID:  "test-workflow-10",
		NodeID:      "conditional-node-10",
		Type:        "conditional",
		Parameters: map[string]any{
			"expression": "$response.status == 200",
		},
		Input: map[string]any{
			"$response": map[string]interface{}{
				"status": 200,
				"body":   "OK",
			},
		},
	}

	node := NewConditionalNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resultVal, ok := result["result"].(bool); !ok || !resultVal {
		t.Errorf("Expected result true for nested field access, got %v", result["result"])
	}
}

func TestConditionalNode_ComplexExpression(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-11",
		WorkflowID:  "test-workflow-11",
		NodeID:      "conditional-node-11",
		Type:        "conditional",
		Parameters: map[string]any{
			"expression": "$status == 200 and $body contains 'success' or $retry == true",
		},
		Input: map[string]any{
			"$status": 200,
			"$body":   "success message",
			"$retry":  false,
		},
	}

	node := NewConditionalNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resultVal, ok := result["result"].(bool); !ok || !resultVal {
		t.Errorf("Expected result true for complex expression, got %v", result["result"])
	}
}

func TestConditionalNode_EmptyExpression(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-12",
		WorkflowID:  "test-workflow-12",
		NodeID:      "conditional-node-12",
		Type:        "conditional",
		Parameters:  map[string]any{},
		Input:       map[string]any{},
	}

	node := NewConditionalNode(execCtx)
	_, err := node.Execute(context.Background(), execCtx)

	if err == nil {
		t.Error("Expected error for empty expression, got nil")
	}
}

func TestConditionalNode_InvalidExpression(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-13",
		WorkflowID:  "test-workflow-13",
		NodeID:      "conditional-node-13",
		Type:        "conditional",
		Parameters: map[string]any{
			"expression": "$nonexistent == 200",
		},
		Input: map[string]any{},
	}

	node := NewConditionalNode(execCtx)
	_, err := node.Execute(context.Background(), execCtx)

	if err == nil {
		t.Error("Expected error for invalid reference, got nil")
	}
}

func TestConditionalNode_StringComparison(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-14",
		WorkflowID:  "test-workflow-14",
		NodeID:      "conditional-node-14",
		Type:        "conditional",
		Parameters: map[string]any{
			"expression": "$env == 'production'",
		},
		Input: map[string]any{
			"$env": "production",
		},
	}

	node := NewConditionalNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resultVal, ok := result["result"].(bool); !ok || !resultVal {
		t.Errorf("Expected result true for string comparison, got %v", result["result"])
	}
}

func TestConditionalNode_NotEqual(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-15",
		WorkflowID:  "test-workflow-15",
		NodeID:      "conditional-node-15",
		Type:        "conditional",
		Parameters: map[string]any{
			"expression": "$status != 404",
		},
		Input: map[string]any{
			"$status": 200,
		},
	}

	node := NewConditionalNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resultVal, ok := result["result"].(bool); !ok || !resultVal {
		t.Errorf("Expected result true for != comparison, got %v", result["result"])
	}
}

func TestConditionalNode_GreaterOrEqual(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-16",
		WorkflowID:  "test-workflow-16",
		NodeID:      "conditional-node-16",
		Type:        "conditional",
		Parameters: map[string]any{
			"expression": "$count >= 10",
		},
		Input: map[string]any{
			"$count": 10,
		},
	}

	node := NewConditionalNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resultVal, ok := result["result"].(bool); !ok || !resultVal {
		t.Errorf("Expected result true for >= comparison, got %v", result["result"])
	}
}

func TestConditionalNode_LessOrEqual(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-17",
		WorkflowID:  "test-workflow-17",
		NodeID:      "conditional-node-17",
		Type:        "conditional",
		Parameters: map[string]any{
			"expression": "$count <= 5",
		},
		Input: map[string]any{
			"$count": 5,
		},
	}

	node := NewConditionalNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resultVal, ok := result["result"].(bool); !ok || !resultVal {
		t.Errorf("Expected result true for <= comparison, got %v", result["result"])
	}
}
