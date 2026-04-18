package datetimenow

import (
	"context"
	"testing"
	"time"

	"rune-worker/plugin"
)

func TestNowInUTC(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{"timezone": "UTC"}})
	node.now = func() time.Time { return time.Date(2026, 3, 8, 10, 0, 0, 0, time.UTC) }
	out, err := node.Execute(context.Background(), plugin.ExecutionContext{})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if out["result"] != "2026-03-08T10:00:00Z" {
		t.Fatalf("result: %v", out["result"])
	}
	if out["timezone"] != "UTC" {
		t.Fatalf("timezone: %v", out["timezone"])
	}
	if out["unix"] != int64(1772964000) {
		t.Fatalf("unix: %v", out["unix"])
	}
}

func TestNowAppliesTimezone(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"timezone": "America/New_York",
		"format":   "2006-01-02 15:04 MST",
	}})
	node.now = func() time.Time { return time.Date(2026, 3, 8, 15, 30, 0, 0, time.UTC) }
	out, err := node.Execute(context.Background(), plugin.ExecutionContext{})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if out["result"] != "2026-03-08 11:30 EDT" {
		t.Fatalf("timezone not applied, got %v", out["result"])
	}
}

func TestNowInvalidTimezone(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{"timezone": "Mars/Base"}})
	if _, err := node.Execute(context.Background(), plugin.ExecutionContext{}); err == nil {
		t.Fatal("expected error for invalid timezone")
	}
}
