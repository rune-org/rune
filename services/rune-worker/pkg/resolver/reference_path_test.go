package resolver

import "testing"

func TestParsePathSegmentsStrict_InvalidPaths(t *testing.T) {
	t.Parallel()

	tests := []string{
		"",
		"user..name",
		"user.",
		"items[]",
		"items[abc]",
		"items[0",
		"items]",
	}

	for _, path := range tests {
		t.Run(path, func(t *testing.T) {
			t.Parallel()
			if _, err := parsePathSegmentsStrict(path); err == nil {
				t.Fatalf("expected parse error for path %q", path)
			}
		})
	}
}

func TestNavigateValuePath_StrictArrayValidation(t *testing.T) {
	t.Parallel()

	data := map[string]interface{}{
		"items": []interface{}{"a", "b"},
	}

	if _, err := NavigateValuePath(data, "items[10]"); err == nil {
		t.Fatalf("expected out-of-bounds error")
	}
	if _, err := NavigateValuePath(data, "items[-1]"); err == nil {
		t.Fatalf("expected negative-index error")
	}
	if _, err := NavigateValuePath(data, "items[foo]"); err == nil {
		t.Fatalf("expected invalid-index error")
	}
}

func TestResolveReferenceValue_DirectLookupFallback(t *testing.T) {
	t.Parallel()

	ctx := map[string]interface{}{
		"$input": map[string]interface{}{"name": "primary"},
		"$raw":   "raw-value",
	}

	value, key, err := ResolveReferenceValue(ctx, "$input.name", false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if key != "$input" {
		t.Fatalf("expected root key $input, got %s", key)
	}
	if value != "primary" {
		t.Fatalf("expected primary, got %v", value)
	}

	ctx = map[string]interface{}{
		"$input.name": "fallback",
	}
	value, key, err = ResolveReferenceValue(ctx, "$input.name", true)
	if err != nil {
		t.Fatalf("unexpected fallback error: %v", err)
	}
	if key != "$input.name" {
		t.Fatalf("expected key $input.name, got %s", key)
	}
	if value != "fallback" {
		t.Fatalf("expected fallback value, got %v", value)
	}
}
