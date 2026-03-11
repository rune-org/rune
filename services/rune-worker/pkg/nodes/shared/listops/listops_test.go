package listops

import "testing"

func TestResolveArrayInput_DefaultsToJSON(t *testing.T) {
	items, err := ResolveArrayInput(map[string]any{"$json": []any{1, 2, 3}}, nil)
	if err != nil {
		t.Fatalf("resolve error: %v", err)
	}
	if len(items) != 3 {
		t.Fatalf("expected 3 items, got %d", len(items))
	}
}

func TestResolveArrayInput_ResolvesReferenceWithoutDollar(t *testing.T) {
	items, err := ResolveArrayInput(map[string]any{"$json": map[string]any{"items": []any{"a", "b"}}}, "json.items")
	if err != nil {
		t.Fatalf("resolve error: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
}

func TestGetFieldValue(t *testing.T) {
	value, err := GetFieldValue(map[string]any{"customer": map[string]any{"email": "a@b.com"}}, "customer.email")
	if err != nil {
		t.Fatalf("field error: %v", err)
	}
	if value != "a@b.com" {
		t.Fatalf("unexpected value: %v", value)
	}
}

func TestCompareForSort(t *testing.T) {
	cmp, err := CompareForSort("2026-03-01", "2026-03-02", "date")
	if err != nil {
		t.Fatalf("compare error: %v", err)
	}
	if cmp >= 0 {
		t.Fatalf("expected left < right, got %d", cmp)
	}
}
