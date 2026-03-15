package limitnode

import (
	"context"
	"reflect"
	"testing"

	"rune-worker/plugin"
)

func TestLimitNodeScenarios(t *testing.T) {
	tests := []struct {
		name       string
		parameters map[string]any
		input      map[string]any
		want       []any
	}{
		{
			name:       "take first two explicit items",
			parameters: map[string]any{"input_array": []any{1, 2, 3, 4}, "count": 2},
			input:      map[string]any{},
			want:       []any{1, 2},
		},
		{
			name:       "count larger than array keeps all items",
			parameters: map[string]any{"input_array": []any{"a", "b"}, "count": 5},
			input:      map[string]any{},
			want:       []any{"a", "b"},
		},
		{
			name:       "count zero returns empty list",
			parameters: map[string]any{"input_array": []any{"a", "b"}, "count": 0},
			input:      map[string]any{},
			want:       []any{},
		},
		{
			name:       "reads from working json by default",
			parameters: map[string]any{"count": 3},
			input:      map[string]any{"$json": []any{"x", "y", "z", "w"}},
			want:       []any{"x", "y", "z"},
		},
		{
			name:       "parses string count",
			parameters: map[string]any{"input_array": []any{1, 2, 3}, "count": "2"},
			input:      map[string]any{},
			want:       []any{1, 2},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node := NewLimitNode(plugin.ExecutionContext{Parameters: tt.parameters})
			output, err := node.Execute(context.Background(), plugin.ExecutionContext{Input: tt.input})
			if err != nil {
				t.Fatalf("execute error: %v", err)
			}
			items := output["$json"].([]any)
			if !reflect.DeepEqual(items, tt.want) {
				t.Fatalf("unexpected items: got %v want %v", items, tt.want)
			}
			if output["count"] != len(tt.want) {
				t.Fatalf("unexpected count: %v", output["count"])
			}
		})
	}
}

func TestLimitNodeValidation(t *testing.T) {
	tests := []struct {
		name       string
		parameters map[string]any
		input      map[string]any
	}{
		{
			name:       "rejects negative count",
			parameters: map[string]any{"input_array": []any{1, 2, 3}, "count": -1},
			input:      map[string]any{},
		},
		{
			name:       "requires count",
			parameters: map[string]any{"input_array": []any{1, 2, 3}},
			input:      map[string]any{},
		},
		{
			name:       "rejects non array input",
			parameters: map[string]any{"input_array": map[string]any{"foo": "bar"}, "count": 1},
			input:      map[string]any{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node := NewLimitNode(plugin.ExecutionContext{Parameters: tt.parameters})
			if _, err := node.Execute(context.Background(), plugin.ExecutionContext{Input: tt.input}); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}
