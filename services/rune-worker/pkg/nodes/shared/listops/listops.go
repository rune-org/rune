// Centralizes shared list-transform behavior used by nodes like filter,
// sort, and limit so array resolution, field lookup, and comparison
// rules stay consistent across implementations.

package listops

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"

	"rune-worker/pkg/resolver"
)

// ResolveArrayInput resolves a node array input from either:
// - an already-resolved slice value
// - a reference string such as $json.items
// - nil, which falls back to $json
func ResolveArrayInput(input map[string]any, raw any) ([]any, error) {
	if raw == nil {
		raw = input["$json"]
	}

	resolved, err := resolveValue(input, raw)
	if err != nil {
		return nil, err
	}

	items, ok := ToAnySlice(resolved)
	if !ok {
		return nil, fmt.Errorf("expected array input, got %T", resolved)
	}

	return items, nil
}

func resolveValue(input map[string]any, raw any) (any, error) {
	if s, ok := raw.(string); ok {
		trimmed := strings.TrimSpace(s)
		if trimmed == "" {
			return nil, fmt.Errorf("array input cannot be empty")
		}

		if strings.HasPrefix(trimmed, "$") {
			resolved, _, err := resolver.ResolveReferenceValue(input, trimmed, true)
			if err != nil {
				return nil, fmt.Errorf("failed to resolve reference %q: %w", trimmed, err)
			}
			return resolved, nil
		}

		if !strings.HasPrefix(trimmed, "$") {
			resolved, _, err := resolver.ResolveReferenceValue(input, withDollarRoot(trimmed), true)
			if err == nil {
				return resolved, nil
			}
		}
	}

	return raw, nil
}

func withDollarRoot(path string) string {
	if path == "" || strings.HasPrefix(path, "$") {
		return path
	}

	parts := strings.SplitN(path, ".", 2)
	if len(parts) == 1 {
		return "$" + parts[0]
	}
	return "$" + parts[0] + "." + parts[1]
}

func ToAnySlice(value any) ([]any, bool) {
	if value == nil {
		return nil, false
	}

	if items, ok := value.([]any); ok {
		return items, true
	}

	rv := reflect.ValueOf(value)
	if rv.Kind() != reflect.Slice && rv.Kind() != reflect.Array {
		return nil, false
	}

	items := make([]any, rv.Len())
	for i := 0; i < rv.Len(); i++ {
		items[i] = rv.Index(i).Interface()
	}
	return items, true
}

func CloneSlice(items []any) []any {
	if items == nil {
		return nil
	}
	cloned := make([]any, len(items))
	copy(cloned, items)
	return cloned
}

func GetFieldValue(item any, field string) (any, error) {
	field = strings.TrimSpace(field)
	if field == "" {
		return item, nil
	}
	field = strings.TrimPrefix(field, "$item.")

	trimmed := strings.TrimPrefix(field, "$")
	trimmed = strings.TrimPrefix(trimmed, ".")
	if trimmed == "" {
		return item, nil
	}

	value, err := resolver.NavigateValuePath(item, trimmed)
	if err != nil {
		return nil, err
	}
	return value, nil
}

// NormalizeItemFieldPath converts a full picked reference into a field path for
// each item in the selected list. Example:
// input_array = $fetch_posts.body.posts
// field      = $fetch_posts.body.posts[0].userId
// result     = userId
func NormalizeItemFieldPath(inputArray any, field string) string {
	field = strings.TrimSpace(field)
	if field == "" {
		return field
	}
	if strings.HasPrefix(field, "$item.") {
		return strings.TrimPrefix(field, "$item.")
	}

	inputRef, ok := inputArray.(string)
	if !ok || strings.TrimSpace(inputRef) == "" {
		return field
	}

	base := withDollarRoot(strings.TrimSpace(inputRef))
	fieldRef := withDollarRoot(field)

	for _, prefix := range []string{base + ".", base + "[0]."} {
		if strings.HasPrefix(fieldRef, prefix) {
			return strings.TrimPrefix(fieldRef, prefix)
		}
	}

	if strings.HasPrefix(fieldRef, base+"[") {
		remaining := strings.TrimPrefix(fieldRef, base)
		if strings.HasPrefix(remaining, "[") {
			if closeIdx := strings.Index(remaining, "]"); closeIdx >= 0 {
				if closeIdx == len(remaining)-1 {
					return ""
				}
				if len(remaining) > closeIdx+2 && remaining[closeIdx+1] == '.' {
					return remaining[closeIdx+2:]
				}
			}
		}
	}

	return field
}

func CompareValues(left, right any, operator string) (bool, error) {
	operator = strings.TrimSpace(strings.ToLower(operator))
	switch operator {
	case "==", "is equal to":
		return equalValues(left, right), nil
	case "!=", "is not equal to":
		return !equalValues(left, right), nil
	case ">", "is greater than":
		return orderedCompare(left, right, func(c int) bool { return c > 0 })
	case "<", "is less than":
		return orderedCompare(left, right, func(c int) bool { return c < 0 })
	case ">=", "is greater than or equal to":
		return orderedCompare(left, right, func(c int) bool { return c >= 0 })
	case "<=", "is less than or equal to":
		return orderedCompare(left, right, func(c int) bool { return c <= 0 })
	case "contains":
		return strings.Contains(fmt.Sprintf("%v", left), fmt.Sprintf("%v", right)), nil
	default:
		return false, fmt.Errorf("unsupported operator: %s", operator)
	}
}

func equalValues(left, right any) bool {
	if left == nil && right == nil {
		return true
	}
	if left == nil || right == nil {
		return false
	}

	if lf, ok := toFloat(left); ok {
		if rf, ok := toFloat(right); ok {
			return lf == rf
		}
	}

	if lb, ok := toBool(left); ok {
		if rb, ok := toBool(right); ok {
			return lb == rb
		}
	}

	return fmt.Sprintf("%v", left) == fmt.Sprintf("%v", right)
}

func orderedCompare(left, right any, predicate func(int) bool) (bool, error) {
	cmp, err := CompareForSort(left, right, "auto")
	if err != nil {
		return false, err
	}
	return predicate(cmp), nil
}

// CompareForSort compares two values for sorting.
// It returns -1 if left < right, 0 if equal, and 1 if left > right.
func CompareForSort(left, right any, valueType string) (int, error) {
	if left == nil && right == nil {
		return 0, nil
	}
	if left == nil {
		return 1, nil
	}
	if right == nil {
		return -1, nil
	}

	switch strings.ToLower(strings.TrimSpace(valueType)) {
	case "number":
		lf, lok := toFloat(left)
		rf, rok := toFloat(right)
		if !lok || !rok {
			return 0, fmt.Errorf("cannot compare non-number values %v and %v as numbers", left, right)
		}
		return compareFloats(lf, rf), nil
	case "date", "datetime", "time":
		lt, err := toTime(left)
		if err != nil {
			return 0, err
		}
		rt, err := toTime(right)
		if err != nil {
			return 0, err
		}
		if lt.Before(rt) {
			return -1, nil
		}
		if lt.After(rt) {
			return 1, nil
		}
		return 0, nil
	case "text", "string":
		return strings.Compare(strings.ToLower(fmt.Sprintf("%v", left)), strings.ToLower(fmt.Sprintf("%v", right))), nil
	case "auto", "":
		if lf, lok := toFloat(left); lok {
			if rf, rok := toFloat(right); rok {
				return compareFloats(lf, rf), nil
			}
		}
		if lt, err := toTime(left); err == nil {
			if rt, err := toTime(right); err == nil {
				if lt.Before(rt) {
					return -1, nil
				}
				if lt.After(rt) {
					return 1, nil
				}
				return 0, nil
			}
		}
		return strings.Compare(strings.ToLower(fmt.Sprintf("%v", left)), strings.ToLower(fmt.Sprintf("%v", right))), nil
	default:
		return 0, fmt.Errorf("unsupported sort type: %s", valueType)
	}
}

func compareFloats(left, right float64) int {
	if left < right {
		return -1
	}
	if left > right {
		return 1
	}
	return 0
}

func ParseComparable(raw any) any {
	if s, ok := raw.(string); ok {
		trimmed := strings.TrimSpace(s)
		if trimmed == "" {
			return ""
		}
		if unquoted, ok := unquote(trimmed); ok {
			return unquoted
		}
		if f, ok := toFloat(trimmed); ok {
			return f
		}
		if b, ok := toBool(trimmed); ok {
			return b
		}
		if strings.EqualFold(trimmed, "null") || strings.EqualFold(trimmed, "nil") {
			return nil
		}
		return trimmed
	}
	return raw
}

func StringValue(value any) string {
	s, _ := value.(string)
	return s
}

func ToInt(value any) (int, bool) {
	switch v := value.(type) {
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(v))
		return parsed, err == nil
	}

	rv := reflect.ValueOf(value)
	switch rv.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return int(rv.Int()), true
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return int(rv.Uint()), true
	case reflect.Float32, reflect.Float64:
		f := rv.Float()
		if f != float64(int(f)) {
			return 0, false
		}
		return int(f), true
	default:
		return 0, false
	}
}

func unquote(value string) (string, bool) {
	if len(value) < 2 {
		return "", false
	}
	if (strings.HasPrefix(value, `"`) && strings.HasSuffix(value, `"`)) ||
		(strings.HasPrefix(value, `'`) && strings.HasSuffix(value, `'`)) {
		return value[1 : len(value)-1], true
	}
	return "", false
}

func toFloat(value any) (float64, bool) {
	switch v := value.(type) {
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
		return f, err == nil
	}

	rv := reflect.ValueOf(value)
	switch rv.Kind() {
	case reflect.Float32, reflect.Float64:
		return rv.Float(), true
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return float64(rv.Int()), true
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return float64(rv.Uint()), true
	default:
		return 0, false
	}
}

func toBool(value any) (bool, bool) {
	switch v := value.(type) {
	case bool:
		return v, true
	case string:
		switch strings.ToLower(strings.TrimSpace(v)) {
		case "true", "1", "yes":
			return true, true
		case "false", "0", "no":
			return false, true
		}
	}
	return false, false
}

func toTime(value any) (time.Time, error) {
	switch v := value.(type) {
	case time.Time:
		return v, nil
	case string:
		return parseTimeString(v)
	default:
		return time.Time{}, fmt.Errorf("cannot parse %T as time", value)
	}
}

// CommonTimeFormats is the ordered list of time formats used by date/time
// parsing across the worker. Keep this list in sync and use it everywhere
// to avoid drift between nodes.
var CommonTimeFormats = []string{
	time.RFC3339,
	time.RFC3339Nano,
	"2006-01-02 15:04:05",
	"2006-01-02 15:04",
	"2006-01-02",
	time.RFC1123Z,
	time.RFC1123,
	// Minute-precision RFC1123 variants (no seconds) — the format presets
	// offered by the datetime inspector emit these, so the parser must
	// accept them when a datetime node's result is piped into another.
	"Mon, 02 Jan 2006 15:04 MST",
	"Mon, 02 Jan 2006 15:04 -0700",
	"02 Jan 2006 15:04 MST",
	"02 Jan 2006 15:04 -0700",
	"02 Jan 2006",
	time.RFC822Z,
	time.RFC822,
}

func parseTimeString(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	for _, format := range CommonTimeFormats {
		if parsed, err := time.Parse(format, value); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported time value: %s", value)
}
