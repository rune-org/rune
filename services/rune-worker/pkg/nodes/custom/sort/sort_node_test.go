package sortnode

import (
	"context"
	"reflect"
	"testing"

	"rune-worker/plugin"
)

func TestSortNodeScenarios(t *testing.T) {
	tests := []struct {
		name       string
		parameters map[string]any
		input      map[string]any
		wantIDs    []string
	}{
		{
			name: "sort invoices by total descending",
			parameters: map[string]any{
				"input_array": []any{
					map[string]any{"id": "i1", "total": 10.0},
					map[string]any{"id": "i2", "total": 50.0},
					map[string]any{"id": "i3", "total": 20.0},
				},
				"rules": []any{map[string]any{"field": "total", "direction": "desc", "type": "number"}},
			},
			input:   map[string]any{},
			wantIDs: []string{"i2", "i3", "i1"},
		},
		{
			name: "sort events by date ascending from working json",
			parameters: map[string]any{
				"rules": []any{map[string]any{"field": "scheduled_at", "direction": "asc", "type": "date"}},
			},
			input: map[string]any{
				"$json": []any{
					map[string]any{"id": "e1", "scheduled_at": "2026-03-10T10:00:00Z"},
					map[string]any{"id": "e2", "scheduled_at": "2026-03-08T10:00:00Z"},
					map[string]any{"id": "e3", "scheduled_at": "2026-03-09T10:00:00Z"},
				},
			},
			wantIDs: []string{"e2", "e3", "e1"},
		},
		{
			name: "multi rule sort keeps stable groups",
			parameters: map[string]any{
				"input_array": []any{
					map[string]any{"id": "u1", "team": "B", "name": "Zed"},
					map[string]any{"id": "u2", "team": "A", "name": "Mia"},
					map[string]any{"id": "u3", "team": "A", "name": "Ava"},
					map[string]any{"id": "u4", "team": "B", "name": "Ana"},
				},
				"rules": []any{
					map[string]any{"field": "team", "direction": "asc", "type": "text"},
					map[string]any{"field": "name", "direction": "asc", "type": "text"},
				},
			},
			input:   map[string]any{},
			wantIDs: []string{"u3", "u2", "u4", "u1"},
		},
		{
			name: "missing values sort last",
			parameters: map[string]any{
				"input_array": []any{
					map[string]any{"id": "p1", "score": 90.0},
					map[string]any{"id": "p2"},
					map[string]any{"id": "p3", "score": 80.0},
				},
				"rules": []any{map[string]any{"field": "score", "direction": "asc", "type": "number"}},
			},
			input:   map[string]any{},
			wantIDs: []string{"p3", "p1", "p2"},
		},
		{
			name: "accepts full picked field path and normalizes to item field",
			parameters: map[string]any{
				"input_array": "$fetch_posts.body.posts",
				"rules":       []any{map[string]any{"field": "$fetch_posts.body.posts[0].id", "direction": "desc", "type": "number"}},
			},
			input: map[string]any{
				"$fetch_posts": map[string]any{"body": map[string]any{"posts": []any{
					map[string]any{"id": "1"},
					map[string]any{"id": "3"},
					map[string]any{"id": "2"},
				}}},
			},
			wantIDs: []string{"3", "2", "1"},
		},
		{
			name: "discovers single incoming http array when input array is blank",
			parameters: map[string]any{
				"rules": []any{map[string]any{"field": "$item.id", "direction": "desc", "type": "auto"}},
			},
			input: map[string]any{
				"$HTTP": map[string]any{
					"status": 200,
					"body": map[string]any{
						"posts": []any{
							map[string]any{"id": "1"},
							map[string]any{"id": "3"},
							map[string]any{"id": "2"},
						},
						"total": 60,
						"skip":  0,
						"limit": 60,
					},
				},
			},
			wantIDs: []string{"3", "2", "1"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node := NewSortNode(plugin.ExecutionContext{Parameters: tt.parameters})
			output, err := node.Execute(context.Background(), plugin.ExecutionContext{Input: tt.input})
			if err != nil {
				t.Fatalf("execute error: %v", err)
			}
			items := output["$json"].([]any)
			gotIDs := make([]string, 0, len(items))
			for _, item := range items {
				gotIDs = append(gotIDs, item.(map[string]any)["id"].(string))
			}
			if !reflect.DeepEqual(gotIDs, tt.wantIDs) {
				t.Fatalf("unexpected ids: got %v want %v", gotIDs, tt.wantIDs)
			}
		})
	}
}

func TestSortNodeValidation(t *testing.T) {
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
			name:       "rejects unsupported sort type",
			parameters: map[string]any{"input_array": []any{map[string]any{"id": "x", "score": 1}, map[string]any{"id": "y", "score": 2}}, "rules": []any{map[string]any{"field": "score", "direction": "asc", "type": "currency"}}},
			input:      map[string]any{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node := NewSortNode(plugin.ExecutionContext{Parameters: tt.parameters})
			if _, err := node.Execute(context.Background(), plugin.ExecutionContext{Input: tt.input}); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}
