package splitnode

import (
	"context"
	"testing"

	"rune-worker/plugin"
)

func TestSplitNode_Execute(t *testing.T) {
	tests := []struct {
		name      string
		input     map[string]any
		params    map[string]any
		wantItems int
		wantErr   bool
	}{
		{
			name: "valid string array",
			params: map[string]any{
				"input_array": []string{"a", "b", "c"},
			},
			wantItems: 3,
			wantErr:   false,
		},
		{
			name: "valid int array",
			params: map[string]any{
				"input_array": []int{1, 2, 3, 4},
			},
			wantItems: 4,
			wantErr:   false,
		},
		{
			name: "valid any array",
			params: map[string]any{
				"input_array": []any{"a", 1, true},
			},
			wantItems: 3,
			wantErr:   false,
		},
		{
			name:      "missing parameter",
			params:    map[string]any{},
			wantItems: 0,
			wantErr:   true,
		},
		{
			name: "invalid type",
			params: map[string]any{
				"input_array": "not an array",
			},
			wantItems: 0,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			execCtx := plugin.ExecutionContext{
				NodeID:     "test_node",
				Parameters: tt.params,
				Input:      tt.input,
				// RedisClient is nil, which should be handled gracefully (log warning)
			}

			node := NewSplitNode(execCtx)
			output, err := node.Execute(context.Background(), execCtx)

			if tt.wantErr {
				if err == nil {
					t.Error("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}

			items, ok := output["_split_items"].([]any)
			if !ok {
				t.Error("output missing _split_items")
				return
			}

			if len(items) != tt.wantItems {
				t.Errorf("expected %d items, got %d", tt.wantItems, len(items))
			}
		})
	}
}
