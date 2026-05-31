package datetimesubtract

import (
	"context"
	"testing"
	"time"

	"rune-worker/plugin"
)

func TestSubtractWeeks(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"date":     "2026-03-22",
		"amount":   2,
		"unit":     "weeks",
		"timezone": "UTC",
		"format":   "2006-01-02",
	}})
	out, err := node.Execute(context.Background(), plugin.ExecutionContext{})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if out["result"] != "2026-03-08" {
		t.Fatalf("result: %v", out["result"])
	}
}

func TestSubtractFromNowWhenDateOmitted(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"amount":   1,
		"unit":     "days",
		"timezone": "UTC",
		"format":   "2006-01-02",
	}})
	node.now = func() time.Time { return time.Date(2026, 3, 8, 10, 0, 0, 0, time.UTC) }
	out, err := node.Execute(context.Background(), plugin.ExecutionContext{})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if out["result"] != "2026-03-07" {
		t.Fatalf("result: %v", out["result"])
	}
}

func TestSubtractRespectsTimezoneOnNaiveInput(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"date":     "2026-03-08 15:30",
		"amount":   0,
		"unit":     "hours",
		"timezone": "America/New_York",
		"format":   "2006-01-02 15:04 MST",
	}})
	out, err := node.Execute(context.Background(), plugin.ExecutionContext{})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if out["result"] != "2026-03-08 15:30 EDT" {
		t.Fatalf("timezone not applied to naive input, got %v", out["result"])
	}
}

func TestSubtractMissingAmount(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"date":     "2026-03-08",
		"unit":     "days",
		"timezone": "UTC",
	}})
	if _, err := node.Execute(context.Background(), plugin.ExecutionContext{}); err == nil {
		t.Fatal("expected error when amount is missing")
	}
}
