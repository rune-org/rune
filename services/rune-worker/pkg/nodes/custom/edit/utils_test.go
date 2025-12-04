package editnode

import (
    "reflect"
    "testing"
)

func TestDeepCopyMap(t *testing.T) {
    src := map[string]any{"a": 1, "nested": map[string]any{"b": "x"}}

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