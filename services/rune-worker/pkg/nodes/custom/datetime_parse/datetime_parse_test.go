package datetimeparse

import (
	"context"
	"testing"

	"rune-worker/plugin"
)

func TestParseExplicitUTCInNewYork(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"date":     "2026-03-08T15:30:00Z",
		"timezone": "America/New_York",
	}})
	out, err := node.Execute(context.Background(), plugin.ExecutionContext{})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	cases := map[string]any{
		"year":     2026,
		"month":    3,
		"day":      8,
		"hour":     11,
		"minute":   30,
		"second":   0,
		"weekday":  "Sunday",
		"iso":      "2026-03-08T11:30:00-04:00",
		"timezone": "America/New_York",
		"unix":     int64(1772983800),
	}
	for key, want := range cases {
		if out[key] != want {
			t.Fatalf("%s: got %v want %v", key, out[key], want)
		}
	}
}

func TestParseNaiveInputUsesTimezone(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"date":     "2026-03-08 12:00",
		"timezone": "America/New_York",
	}})
	out, err := node.Execute(context.Background(), plugin.ExecutionContext{})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if out["hour"] != 12 {
		t.Fatalf("hour: %v", out["hour"])
	}
	if out["iso"] != "2026-03-08T12:00:00-04:00" {
		t.Fatalf("naive input should be interpreted in NY, got %v", out["iso"])
	}
}

func TestParseMissingDate(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{"timezone": "UTC"}})
	if _, err := node.Execute(context.Background(), plugin.ExecutionContext{}); err == nil {
		t.Fatal("expected error when date is missing")
	}
}

func TestParseInvalidTimezone(t *testing.T) {
	node := New(plugin.ExecutionContext{Parameters: map[string]any{
		"date":     "2026-03-08T15:30:00Z",
		"timezone": "Mars/Base",
	}})
	if _, err := node.Execute(context.Background(), plugin.ExecutionContext{}); err == nil {
		t.Fatal("expected error for invalid timezone")
	}
}
