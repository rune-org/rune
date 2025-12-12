package editnode

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// DeepCopyMap performs a deep copy of a map using JSON round trip to avoid shared references.
func DeepCopyMap(src map[string]any) (map[string]any, error) {
	if src == nil {
		return map[string]any{}, nil
	}

	b, err := json.Marshal(src)
	if err != nil {
		return nil, fmt.Errorf("deep copy marshal: %w", err)
	}

	var dst map[string]any
	if err := json.Unmarshal(b, &dst); err != nil {
		return nil, fmt.Errorf("deep copy unmarshal: %w", err)
	}

	return dst, nil
}

// SetNested sets a value on a map following dot notation, creating maps along the path.
func SetNested(obj map[string]any, path string, value any) error {
	if obj == nil {
		return errors.New("target map is nil")
	}
	if path == "" {
		return errors.New("path is empty")
	}

	parts := strings.Split(path, ".")
	current := obj

	for i := 0; i < len(parts)-1; i++ {
		key := parts[i]
		next, exists := current[key]
		if !exists {
			child := map[string]any{}
			current[key] = child
			current = child
			continue
		}

		childMap, ok := next.(map[string]any)
		if !ok {
			return fmt.Errorf("cannot set property '%s' on non-object", key)
		}
		current = childMap
	}

	current[parts[len(parts)-1]] = value
	return nil
}

// TypeCast converts val to the target type (string, number, boolean, json).
func TypeCast(val any, target string) (any, error) {
	switch target {
	case "", "string":
		return fmt.Sprintf("%v", val), nil

	case "number":
		switch v := val.(type) {
		case float64:
			return v, nil
		case float32:
			return float64(v), nil
		case int:
			return float64(v), nil
		case int64:
			return float64(v), nil
		case int32:
			return float64(v), nil
		case int16:
			return float64(v), nil
		case int8:
			return float64(v), nil
		case uint:
			return float64(v), nil
		case uint64:
			return float64(v), nil
		case uint32:
			return float64(v), nil
		case uint16:
			return float64(v), nil
		case uint8:
			return float64(v), nil
		case string:
			f, err := strconv.ParseFloat(v, 64)
			if err != nil {
				return nil, fmt.Errorf("cast to number: %w", err)
			}
			return f, nil
		default:
			return nil, fmt.Errorf("cannot cast %T to number", val)
		}

	case "boolean":
		switch v := val.(type) {
		case bool:
			return v, nil
		case string:
			lower := strings.ToLower(strings.TrimSpace(v))
			if lower == "true" || lower == "yes" || lower == "1" {
				return true, nil
			}
			if lower == "false" || lower == "no" || lower == "0" {
				return false, nil
			}
			return nil, fmt.Errorf("cannot cast string '%s' to boolean", v)
		case int, int8, int16, int32, int64:
			return fmt.Sprint(v) != "0", nil
		case uint, uint8, uint16, uint32, uint64:
			return fmt.Sprint(v) != "0", nil
		case float32:
			return v != 0, nil
		case float64:
			return v != 0, nil
		default:
			return nil, fmt.Errorf("cannot cast %T to boolean", val)
		}

	case "json":
		switch v := val.(type) {
		case string:
			var out any
			if err := json.Unmarshal([]byte(v), &out); err != nil {
				return nil, fmt.Errorf("cast to json: %w", err)
			}
			return out, nil
		case map[string]any, []any:
			return v, nil
		default:
			b, err := json.Marshal(v)
			if err != nil {
				return nil, fmt.Errorf("cast to json marshal: %w", err)
			}
			var out any
			if err := json.Unmarshal(b, &out); err != nil {
				return nil, fmt.Errorf("cast to json unmarshal: %w", err)
			}
			return out, nil
		}

	default:
		return nil, fmt.Errorf("unsupported target type '%s'", target)
	}
}
