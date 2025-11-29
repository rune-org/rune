package switchnode

import (
	"context"
	"testing"

	"rune-worker/plugin"
)

func TestSwitchNode_MatchFirstRule(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-1",
		WorkflowID:  "test-workflow-1",
		NodeID:      "switch-node-1",
		Type:        "switch",
		Parameters: map[string]any{
			"rules": []interface{}{
				map[string]interface{}{
					"value":    "$status",
					"operator": "==",
					"compare":  200,
				},
				map[string]interface{}{
					"value":    "$status",
					"operator": "==",
					"compare":  404,
				},
			},
		},
		Input: map[string]any{
			"$status": 200,
		},
	}

	node := NewSwitchNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if index, ok := result["output_index"].(int); !ok || index != 0 {
		t.Errorf("Expected output_index 0, got %v", result["output_index"])
	}
}

func TestSwitchNode_MatchSecondRule(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-2",
		WorkflowID:  "test-workflow-2",
		NodeID:      "switch-node-2",
		Type:        "switch",
		Parameters: map[string]any{
			"rules": []interface{}{
				map[string]interface{}{
					"value":    "$status",
					"operator": "==",
					"compare":  200,
				},
				map[string]interface{}{
					"value":    "$status",
					"operator": "==",
					"compare":  404,
				},
			},
		},
		Input: map[string]any{
			"$status": 404,
		},
	}

	node := NewSwitchNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if index, ok := result["output_index"].(int); !ok || index != 1 {
		t.Errorf("Expected output_index 1, got %v", result["output_index"])
	}
}

func TestSwitchNode_Fallback(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-3",
		WorkflowID:  "test-workflow-3",
		NodeID:      "switch-node-3",
		Type:        "switch",
		Parameters: map[string]any{
			"rules": []interface{}{
				map[string]interface{}{
					"value":    "$status",
					"operator": "==",
					"compare":  200,
				},
			},
		},
		Input: map[string]any{
			"$status": 500,
		},
	}

	node := NewSwitchNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Fallback index should be len(rules) = 1
	if index, ok := result["output_index"].(int); !ok || index != 1 {
		t.Errorf("Expected output_index 1 (fallback), got %v", result["output_index"])
	}
	if fallback, ok := result["fallback"].(bool); !ok || !fallback {
		t.Errorf("Expected fallback true, got %v", result["fallback"])
	}
}

func TestSwitchNode_ContainsOperator(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-4",
		WorkflowID:  "test-workflow-4",
		NodeID:      "switch-node-4",
		Type:        "switch",
		Parameters: map[string]any{
			"rules": []interface{}{
				map[string]interface{}{
					"value":    "$message",
					"operator": "contains",
					"compare":  "error",
				},
			},
		},
		Input: map[string]any{
			"$message": "An error occurred",
		},
	}

	node := NewSwitchNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if index, ok := result["output_index"].(int); !ok || index != 0 {
		t.Errorf("Expected output_index 0, got %v", result["output_index"])
	}
}

func TestSwitchNode_NestedInput(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-5",
		WorkflowID:  "test-workflow-5",
		NodeID:      "switch-node-5",
		Type:        "switch",
		Parameters: map[string]any{
			"rules": []interface{}{
				map[string]interface{}{
					"value":    "$data.user.id",
					"operator": ">",
					"compare":  100,
				},
			},
		},
		Input: map[string]any{
			"$data": map[string]interface{}{
				"user": map[string]interface{}{
					"id": 150,
				},
			},
		},
	}

	node := NewSwitchNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if index, ok := result["output_index"].(int); !ok || index != 0 {
		t.Errorf("Expected output_index 0, got %v", result["output_index"])
	}
}

func TestSwitchNode_ReferenceComparison(t *testing.T) {
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-6",
		WorkflowID:  "test-workflow-6",
		NodeID:      "switch-node-6",
		Type:        "switch",
		Parameters: map[string]any{
			"rules": []interface{}{
				map[string]interface{}{
					"value":    "$val1",
					"operator": "==",
					"compare":  "$val2",
				},
			},
		},
		Input: map[string]any{
			"$val1": "test",
			"$val2": "test",
		},
	}

	node := NewSwitchNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if index, ok := result["output_index"].(int); !ok || index != 0 {
		t.Errorf("Expected output_index 0, got %v", result["output_index"])
	}
}

func TestSwitchNode_PreservesResolvedRuleValues(t *testing.T) {
	// Simulate a resolver that already replaced "$status" with the numeric status code.
	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-7",
		WorkflowID:  "test-workflow-7",
		NodeID:      "switch-node-7",
		Type:        "switch",
		Parameters: map[string]any{
			"rules": []interface{}{
				map[string]interface{}{
					// Value is already resolved to a number (not a string reference).
					"value":    200,
					"operator": "==",
					"compare":  200,
				},
				map[string]interface{}{
					"value":    "$status",
					"operator": "==",
					"compare":  404,
				},
			},
		},
		Input: map[string]any{
			"$status": 200,
		},
	}

	node := NewSwitchNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if index, ok := result["output_index"].(int); !ok || index != 0 {
		t.Errorf("Expected output_index 0 for resolved numeric value, got %v", result["output_index"])
	}
}
