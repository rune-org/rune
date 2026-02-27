package resolver

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"
)

// ResolveReferenceValue resolves a context reference like $node.field.
// It returns the resolved value and the root context key that was accessed.
func ResolveReferenceValue(
	context map[string]interface{},
	ref string,
	allowDirectRefLookup bool,
) (interface{}, string, error) {
	ref = strings.TrimSpace(ref)
	if !strings.HasPrefix(ref, "$") {
		return ref, "", nil
	}

	path := strings.TrimPrefix(ref, "$")
	if path == "" {
		return nil, "", fmt.Errorf("invalid reference: missing root key")
	}

	parts := strings.SplitN(path, ".", 2)
	rootName := parts[0]
	if rootName == "" {
		return nil, "", fmt.Errorf("invalid reference: missing root key")
	}

	rootKey := "$" + rootName
	nodeData, ok := context[rootKey]
	if !ok {
		if allowDirectRefLookup {
			if val, directFound := context[ref]; directFound {
				return val, ref, nil
			}
		}
		return nil, rootKey, fmt.Errorf("node '%s' not found in context", rootName)
	}

	if len(parts) == 1 {
		return nodeData, rootKey, nil
	}

	value, err := NavigateValuePath(nodeData, parts[1])
	if err != nil {
		return nil, rootKey, err
	}
	return value, rootKey, nil
}

// NavigateValuePath navigates a nested path like "body.values[0].name".
func NavigateValuePath(data interface{}, path string) (interface{}, error) {
	segments, err := parsePathSegmentsStrict(path)
	if err != nil {
		return nil, err
	}

	current := data
	for i, segment := range segments {
		if segment.isArray {
			current, err = getArrayElementStrict(current, segment.arrayIndex)
			if err != nil {
				return nil, fmt.Errorf("at segment %d: %w", i, err)
			}
			continue
		}

		currentMap, ok := current.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("cannot access field '%s' on non-object type %T", segment.field, current)
		}

		value, ok := currentMap[segment.field]
		if !ok {
			return nil, fmt.Errorf("field '%s' not found", segment.field)
		}
		current = value
	}

	return current, nil
}

// pathSegment represents a single segment in a path.
type pathSegment struct {
	field      string
	isArray    bool
	arrayIndex int
}

func parsePathSegmentsStrict(path string) ([]pathSegment, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, fmt.Errorf("path cannot be empty")
	}

	segments := make([]pathSegment, 0, 4)
	i := 0

	for i < len(path) {
		switch path[i] {
		case '.':
			return nil, fmt.Errorf("invalid path '%s': empty segment", path)
		case '[':
			end := strings.IndexByte(path[i:], ']')
			if end == -1 {
				return nil, fmt.Errorf("invalid path '%s': missing closing bracket", path)
			}
			end += i

			indexStr := path[i+1 : end]
			if indexStr == "" {
				return nil, fmt.Errorf("invalid path '%s': empty array index", path)
			}

			index, err := strconv.Atoi(indexStr)
			if err != nil || index < 0 {
				return nil, fmt.Errorf("invalid array index '%s'", indexStr)
			}

			segments = append(segments, pathSegment{
				isArray:    true,
				arrayIndex: index,
			})

			i = end + 1
			if i < len(path) && path[i] == '.' {
				i++
			}
		default:
			start := i
			for i < len(path) && path[i] != '.' && path[i] != '[' {
				if path[i] == ']' {
					return nil, fmt.Errorf("invalid path '%s': unexpected closing bracket", path)
				}
				i++
			}

			field := path[start:i]
			if field == "" {
				return nil, fmt.Errorf("invalid path '%s': empty field", path)
			}

			segments = append(segments, pathSegment{
				field:   field,
				isArray: false,
			})

			if i < len(path) && path[i] == '.' {
				i++
				if i == len(path) {
					return nil, fmt.Errorf("invalid path '%s': trailing dot", path)
				}
			}
		}
	}

	return segments, nil
}

func getArrayElementStrict(data interface{}, index int) (interface{}, error) {
	val := reflect.ValueOf(data)
	if val.Kind() != reflect.Slice && val.Kind() != reflect.Array {
		return nil, fmt.Errorf("cannot index non-array type %T", data)
	}
	if index < 0 || index >= val.Len() {
		return nil, fmt.Errorf("array index %d out of bounds", index)
	}
	return val.Index(index).Interface(), nil
}
