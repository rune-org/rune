package filternode

import (
	"context"
	"reflect"
	"testing"

	"rune-worker/plugin"
)

func TestFilterNodeScenarios(t *testing.T) {
	tests := []struct {
		name       string
		parameters map[string]any
		input      map[string]any
		wantIDs    []string
		wantCount  int
	}{
		{
			name: "keep active high value customers",
			parameters: map[string]any{
				"input_array": []any{
					map[string]any{"id": "c1", "status": "active", "total": 100.0},
					map[string]any{"id": "c2", "status": "inactive", "total": 20.0},
					map[string]any{"id": "c3", "status": "active", "total": 45.0},
				},
				"rules": []any{
					map[string]any{"field": "status", "operator": "==", "value": "active"},
					map[string]any{"field": "total", "operator": ">", "value": 50},
				},
			},
			input:     map[string]any{},
			wantIDs:   []string{"c1"},
			wantCount: 1,
		},
		{
			name: "match any against working json",
			parameters: map[string]any{
				"rules": []any{
					map[string]any{"field": "status", "operator": "==", "value": "vip"},
					map[string]any{"field": "city", "operator": "==", "value": "Cairo"},
				},
				"match_mode": "any",
			},
			input: map[string]any{
				"$json": []any{
					map[string]any{"id": "l1", "status": "new", "city": "Cairo"},
					map[string]any{"id": "l2", "status": "vip", "city": "Paris"},
					map[string]any{"id": "l3", "status": "new", "city": "Rome"},
				},
			},
			wantIDs:   []string{"l1", "l2"},
			wantCount: 2,
		},
		{
			name: "missing fields do not satisfy all mode",
			parameters: map[string]any{
				"input_array": []any{
					map[string]any{"id": "o1", "status": "paid"},
					map[string]any{"id": "o2", "status": "paid", "amount": 70.0},
				},
				"rules": []any{
					map[string]any{"field": "status", "operator": "==", "value": "paid"},
					map[string]any{"field": "amount", "operator": ">", "value": 50},
				},
			},
			input:     map[string]any{},
			wantIDs:   []string{"o2"},
			wantCount: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node := NewFilterNode(plugin.ExecutionContext{Parameters: tt.parameters})
			output, err := node.Execute(context.Background(), plugin.ExecutionContext{Input: tt.input})
			if err != nil {
				t.Fatalf("execute error: %v", err)
			}
			items := output["$json"].([]any)
			if len(items) != tt.wantCount {
				t.Fatalf("expected %d items, got %d", tt.wantCount, len(items))
			}
			gotIDs := make([]string, 0, len(items))
			for _, item := range items {
				gotIDs = append(gotIDs, item.(map[string]any)["id"].(string))
			}
			if !reflect.DeepEqual(gotIDs, tt.wantIDs) {
				t.Fatalf("unexpected ids: got %v want %v", gotIDs, tt.wantIDs)
			}
			if output["count"] != tt.wantCount {
				t.Fatalf("unexpected count: %v", output["count"])
			}
		})
	}
}

func TestFilterNodeValidation(t *testing.T) {
	tests := []struct {
		name       string
		parameters map[string]any
		input      map[string]any
	}{
		{
			name:       "requires rules",
			parameters: map[string]any{"input_array": []any{1, 2}},
			input:      map[string]any{},
		},
		{
			name:       "rejects non array input",
			parameters: map[string]any{"input_array": map[string]any{"id": 1}, "rules": []any{map[string]any{"field": "id", "operator": "==", "value": 1}}},
			input:      map[string]any{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node := NewFilterNode(plugin.ExecutionContext{Parameters: tt.parameters})
			if _, err := node.Execute(context.Background(), plugin.ExecutionContext{Input: tt.input}); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}
