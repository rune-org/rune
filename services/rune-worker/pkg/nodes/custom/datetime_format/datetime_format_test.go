package datetimeformat

import (
	"context"
	"testing"

	"rune-worker/plugin"
)

func TestFormatConvertsExplicitUTCToNY(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"date":     "2026-03-08T15:30:00Z",
		"timezone": "America/New_York",
		"format":   "2006-01-02 15:04 MST",
	}})
	out, err := node.Execute(context.Background(), plugin.ExecutionContext{})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if out["result"] != "2026-03-08 11:30 EDT" {
		t.Fatalf("timezone not applied, got %v", out["result"])
	}
	if out["unix"] != int64(1772983800) {
		t.Fatalf("unix: %v", out["unix"])
	}
}

func TestFormatNaiveInputInterpretedInTimezone(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"date":     "2026-03-08 15:30",
		"timezone": "America/Los_Angeles",
		"format":   "2006-01-02 15:04 MST",
	}})
	out, err := node.Execute(context.Background(), plugin.ExecutionContext{})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	// DST in LA started March 8 2026 at 02:00; 15:30 local is PDT.
	if out["result"] != "2026-03-08 15:30 PDT" {
		t.Fatalf("naive input timezone not applied, got %v", out["result"])
	}
}

func TestFormatMissingDate(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{"timezone": "UTC"}})
	if _, err := node.Execute(context.Background(), plugin.ExecutionContext{}); err == nil {
		t.Fatal("expected error when date is missing")
	}
}

func TestFormatBadDate(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"date":     "not-a-date",
		"timezone": "UTC",
	}})
	if _, err := node.Execute(context.Background(), plugin.ExecutionContext{}); err == nil {
		t.Fatal("expected error for unparseable date")
	}
}

func TestFormatInvalidTimezone(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"date":     "2026-03-08T15:30:00Z",
		"timezone": "Mars/Base",
	}})
	if _, err := node.Execute(context.Background(), plugin.ExecutionContext{}); err == nil {
		t.Fatal("expected error for invalid timezone")
	}
}
