package editnode

import (
	"reflect"
	"testing"
)

func TestDeepCopyMap(t *testing.T) {
	src := map[string]any{"a": float64(1), "nested": map[string]any{"b": "x"}}

	dst, err := DeepCopyMap(src)
	if err != nil {
		t.Fatalf("DeepCopyMap error: %v", err)
	}

	if !reflect.DeepEqual(src, dst) {
		t.Fatalf("copied map mismatch: got %+v", dst)
	}

	// mutate copy, source should stay
	nested := dst["nested"].(map[string]any)
	nested["b"] = "changed"
	if src["nested"].(map[string]any)["b"] != "x" {
		t.Fatalf("source mutated when copy changed")
	}
}

func TestDeepCopyMap_Nil(t *testing.T) {
	dst, err := DeepCopyMap(nil)
	if err != nil {
		t.Fatalf("DeepCopyMap error: %v", err)
	}
	if dst == nil || len(dst) != 0 {
		t.Fatalf("expected empty map, got %+v", dst)
	}
}

func TestDeepCopyMap_Complex(t *testing.T) {
	src := map[string]any{
		"string": "hello",
		"number": float64(123),
		"bool":   true,
		"array":  []any{1, 2, 3},
		"nested": map[string]any{
			"deep": map[string]any{
				"value": "deep_value",
			},
		},
	}

	dst, err := DeepCopyMap(src)
	if err != nil {
		t.Fatalf("DeepCopyMap error: %v", err)
	}

	// Verify deep copy by modifying source
	src["nested"].(map[string]any)["deep"].(map[string]any)["value"] = "modified"

	// dst should not be affected
	if dst["nested"].(map[string]any)["deep"].(map[string]any)["value"] != "deep_value" {
		t.Fatalf("deep copy not independent: nested.deep.value was modified")
	}
}

func TestSetNested(t *testing.T) {
	obj := map[string]any{}
	if err := SetNested(obj, "a.b.c", 5); err != nil {
		t.Fatalf("SetNested error: %v", err)
	}

	expect := map[string]any{"a": map[string]any{"b": map[string]any{"c": 5}}}
	if !reflect.DeepEqual(obj, expect) {
		t.Fatalf("unexpected map: %+v", obj)
	}
}

func TestSetNested_SingleKey(t *testing.T) {
	obj := map[string]any{}
	if err := SetNested(obj, "key", "value"); err != nil {
		t.Fatalf("SetNested error: %v", err)
	}

	if obj["key"] != "value" {
		t.Fatalf("expected 'value', got %v", obj["key"])
	}
}

func TestSetNested_ExistingPath(t *testing.T) {
	obj := map[string]any{
		"a": map[string]any{
			"b": map[string]any{
				"existing": "data",
			},
		},
	}

	if err := SetNested(obj, "a.b.new", "value"); err != nil {
		t.Fatalf("SetNested error: %v", err)
	}

	// Verify existing data is preserved
	if obj["a"].(map[string]any)["b"].(map[string]any)["existing"] != "data" {
		t.Fatalf("existing data was overwritten")
	}
	if obj["a"].(map[string]any)["b"].(map[string]any)["new"] != "value" {
		t.Fatalf("new value not set")
	}
}

func TestSetNested_OverwriteValue(t *testing.T) {
	obj := map[string]any{
		"a": map[string]any{
			"b": "old_value",
		},
	}

	if err := SetNested(obj, "a.b", "new_value"); err != nil {
		t.Fatalf("SetNested error: %v", err)
	}

	if obj["a"].(map[string]any)["b"] != "new_value" {
		t.Fatalf("value not overwritten: got %v", obj["a"].(map[string]any)["b"])
	}
}

func TestSetNested_NonObjectInPath(t *testing.T) {
	obj := map[string]any{
		"a": "not_a_map",
	}

	err := SetNested(obj, "a.b.c", "value")
	if err == nil {
		t.Fatalf("expected error when traversing non-object")
	}
}

func TestSetNested_NilMap(t *testing.T) {
	err := SetNested(nil, "key", "value")
	if err == nil {
		t.Fatalf("expected error for nil map")
	}
}

func TestSetNested_EmptyPath(t *testing.T) {
	obj := map[string]any{}
	err := SetNested(obj, "", "value")
	if err == nil {
		t.Fatalf("expected error for empty path")
	}
}

func TestTypeCast(t *testing.T) {
	tests := []struct {
		val    any
		target string
		want   any
	}{
		{"123", "number", float64(123)},
		{123, "string", "123"},
		{"true", "boolean", true},
		{"[1,2]", "json", []any{float64(1), float64(2)}},
	}

	for _, tt := range tests {
		got, err := TypeCast(tt.val, tt.target)
		if err != nil {
			t.Fatalf("TypeCast(%v,%s) error: %v", tt.val, tt.target, err)
		}
		if !reflect.DeepEqual(got, tt.want) {
			t.Fatalf("TypeCast(%v,%s)=%v want %v", tt.val, tt.target, got, tt.want)
		}
	}
}

func TestTypeCast_String(t *testing.T) {
	tests := []struct {
		name   string
		val    any
		target string
		want   string
	}{
		{"int to string", 123, "string", "123"},
		{"float to string", 3.14, "string", "3.14"},
		{"bool to string", true, "string", "true"},
		{"string to string", "hello", "string", "hello"},
		{"empty target defaults to string", "test", "", "test"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := TypeCast(tt.val, tt.target)
			if err != nil {
				t.Fatalf("TypeCast error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("expected %s, got %v", tt.want, got)
			}
		})
	}
}

func TestTypeCast_Number(t *testing.T) {
	tests := []struct {
		name    string
		val     any
		want    float64
		wantErr bool
	}{
		{"string to float", "123.45", 123.45, false},
		{"string int to float", "100", 100, false},
		{"int to float", 42, 42, false},
		{"int64 to float", int64(999), 999, false},
		{"float32 to float64", float32(1.5), 1.5, false},
		{"uint to float", uint(50), 50, false},
		{"invalid string", "hello", 0, true},
		{"empty string", "", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := TypeCast(tt.val, "number")
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			// Allow for floating point imprecision
			diff := got.(float64) - tt.want
			if diff < -0.001 || diff > 0.001 {
				t.Fatalf("expected %v, got %v", tt.want, got)
			}
		})
	}
}

func TestTypeCast_Boolean(t *testing.T) {
	tests := []struct {
		name    string
		val     any
		want    bool
		wantErr bool
	}{
		{"bool true", true, true, false},
		{"bool false", false, false, false},
		{"string true", "true", true, false},
		{"string false", "false", false, false},
		{"string TRUE", "TRUE", true, false},
		{"string FALSE", "FALSE", false, false},
		{"string yes", "yes", true, false},
		{"string no", "no", false, false},
		{"string 1", "1", true, false},
		{"string 0", "0", false, false},
		{"int 1", 1, true, false},
		{"int 0", 0, false, false},
		{"int 10", 10, true, false},
		{"float 1.0", 1.0, true, false},
		{"float 0.0", 0.0, false, false},
		{"invalid string", "maybe", false, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := TypeCast(tt.val, "boolean")
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("expected %v, got %v", tt.want, got)
			}
		})
	}
}

func TestTypeCast_JSON(t *testing.T) {
	tests := []struct {
		name    string
		val     any
		want    any
		wantErr bool
	}{
		{
			name: "string array",
			val:  `[1, 2, 3]`,
			want: []any{float64(1), float64(2), float64(3)},
		},
		{
			name: "string object",
			val:  `{"key": "value", "num": 42}`,
			want: map[string]any{"key": "value", "num": float64(42)},
		},
		{
			name: "map passes through",
			val:  map[string]any{"a": "b"},
			want: map[string]any{"a": "b"},
		},
		{
			name: "array passes through",
			val:  []any{1, 2, 3},
			want: []any{1, 2, 3},
		},
		{
			name:    "invalid json string",
			val:     `{invalid json}`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := TypeCast(tt.val, "json")
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("expected %+v, got %+v", tt.want, got)
			}
		})
	}
}

func TestTypeCast_InvalidType(t *testing.T) {
	_, err := TypeCast("test", "unknown_type")
	if err == nil {
		t.Fatalf("expected error for unknown type")
	}
}

func TestTypeCast_NumberFromVarious(t *testing.T) {
	// Test all integer types
	intTypes := []struct {
		name string
		val  any
		want float64
	}{
		{"int8", int8(10), 10},
		{"int16", int16(100), 100},
		{"int32", int32(1000), 1000},
		{"int64", int64(10000), 10000},
		{"uint8", uint8(20), 20},
		{"uint16", uint16(200), 200},
		{"uint32", uint32(2000), 2000},
		{"uint64", uint64(20000), 20000},
	}

	for _, tt := range intTypes {
		t.Run(tt.name, func(t *testing.T) {
			got, err := TypeCast(tt.val, "number")
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("expected %v, got %v", tt.want, got)
			}
		})
	}
}
