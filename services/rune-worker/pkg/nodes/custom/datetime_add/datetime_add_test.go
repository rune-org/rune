package datetimeadd

import (
	"context"
	"testing"
	"time"

	"rune-worker/plugin"
)

func TestAddDaysUTC(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"date":     "2026-03-08",
		"amount":   3,
		"unit":     "days",
		"timezone": "UTC",
		"format":   "2006-01-02",
	}})
	out, err := node.Execute(context.Background(), plugin.ExecutionContext{})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if out["result"] != "2026-03-11" {
		t.Fatalf("result: %v", out["result"])
	}
}

func TestAddFromNowWhenDateOmitted(t *testing.T) {
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
	if out["result"] != "2026-03-09" {
		t.Fatalf("result: %v", out["result"])
	}
}

func TestAddAcrossDSTBoundaryNY(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"date":     "2026-03-07 12:00",
		"amount":   1,
		"unit":     "days",
		"timezone": "America/New_York",
		"format":   "2006-01-02 15:04 MST",
	}})
	out, err := node.Execute(context.Background(), plugin.ExecutionContext{})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if out["result"] != "2026-03-08 12:00 EDT" {
		t.Fatalf("DST crossing not handled, got %v", out["result"])
	}
}

func TestAddNaiveInputRespectsTimezone(t *testing.T) {
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
		t.Fatalf("naive input timezone not applied, got %v", out["result"])
	}
}

func TestAddMissingAmount(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"date":     "2026-03-08",
		"unit":     "days",
		"timezone": "UTC",
	}})
	if _, err := node.Execute(context.Background(), plugin.ExecutionContext{}); err == nil {
		t.Fatal("expected error when amount is missing")
	}
}

func TestAddRoundTripsCustomFormat(t *testing.T) {
	// Reproduces the Current_Time -> Add_Time chain from issue #525:
	// a minute-precision RFC1123 format must round-trip through the shared parser.
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"date":     "Thu, 16 Apr 2026 19:30 EET",
		"amount":   1,
		"unit":     "days",
		"timezone": "Africa/Cairo",
		"format":   "Mon, 02 Jan 2006 15:04 MST",
	}})
	out, err := node.Execute(context.Background(), plugin.ExecutionContext{})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if out["result"] != "Fri, 17 Apr 2026 19:30 EET" {
		t.Fatalf("result: %v", out["result"])
	}
	if out["iso"] != "2026-04-17T19:30:00+02:00" {
		t.Fatalf("iso: %v", out["iso"])
	}
}

func TestAddBadDate(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"date":     "not-a-date",
		"amount":   1,
		"unit":     "days",
		"timezone": "UTC",
	}})
	if _, err := node.Execute(context.Background(), plugin.ExecutionContext{}); err == nil {
		t.Fatal("expected error for unparseable date")
	}
}
