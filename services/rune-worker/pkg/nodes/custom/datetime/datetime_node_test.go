package datetimenode

import (
	"context"
	"testing"
	"time"

	"rune-worker/plugin"
)

func TestDateTimeNodeScenarios(t *testing.T) {
	tests := []struct {
		name       string
		parameters map[string]any
		now        func() time.Time
		wantResult string
		wantUnix   int64
	}{
		{
			name:       "now in UTC",
			parameters: map[string]any{"operation": "now", "timezone": "UTC"},
			now:        func() time.Time { return time.Date(2026, 3, 8, 10, 0, 0, 0, time.UTC) },
			wantResult: "2026-03-08T10:00:00Z",
			wantUnix:   1772964000,
		},
		{
			name:       "add days to campaign deadline",
			parameters: map[string]any{"operation": "add", "date": "2026-03-08", "amount": 3, "unit": "days", "timezone": "UTC", "format": "2006-01-02"},
			wantResult: "2026-03-11",
			wantUnix:   1773187200,
		},
		{
			name:       "subtract weeks from due date",
			parameters: map[string]any{"operation": "subtract", "date": "2026-03-22", "amount": 2, "unit": "weeks", "timezone": "UTC", "format": "2006-01-02"},
			wantResult: "2026-03-08",
			wantUnix:   1772928000,
		},
		{
			name:       "format existing timestamp in another timezone",
			parameters: map[string]any{"operation": "format", "date": "2026-03-08T15:30:00Z", "timezone": "America/New_York", "format": "2006-01-02 15:04 MST"},
			wantResult: "2026-03-08 11:30 EDT",
			wantUnix:   1772983800,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node := NewDateTimeNode(plugin.ExecutionContext{Parameters: tt.parameters})
			if tt.now != nil {
				node.now = tt.now
			}
			output, err := node.Execute(context.Background(), plugin.ExecutionContext{})
			if err != nil {
				t.Fatalf("execute error: %v", err)
			}
			if output["result"] != tt.wantResult {
				t.Fatalf("unexpected result: %v", output["result"])
			}
			if output["formatted"] != tt.wantResult {
				t.Fatalf("unexpected formatted result: %v", output["formatted"])
			}
			if output["unix"] != tt.wantUnix {
				t.Fatalf("unexpected unix value: %v", output["unix"])
			}
		})
	}
}

func TestDateTimeNodeValidation(t *testing.T) {
	tests := []struct {
		name       string
		parameters map[string]any
	}{
		{
			name:       "invalid timezone",
			parameters: map[string]any{"timezone": "Mars/Base"},
		},
		{
			name:       "missing amount for add",
			parameters: map[string]any{"operation": "add", "date": "2026-03-08", "unit": "days", "timezone": "UTC"},
		},
		{
			name:       "missing date for format",
			parameters: map[string]any{"operation": "format", "timezone": "UTC"},
		},
		{
			name:       "bad date string",
			parameters: map[string]any{"operation": "format", "date": "not-a-date", "timezone": "UTC"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node := NewDateTimeNode(plugin.ExecutionContext{Parameters: tt.parameters})
			if _, err := node.Execute(context.Background(), plugin.ExecutionContext{}); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}
