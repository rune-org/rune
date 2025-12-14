package resolver

import (
	"fmt"
	"reflect"
	"regexp"
	"strconv"
	"strings"
)

// Resolver handles dynamic value resolution from accumulated context.
// It supports references like:
//   - $node_name.field
//   - $node_name.nested.field
//   - $node_name.array[0]
//   - $node_name.body.values[0].val
type Resolver struct {
	context  map[string]interface{}
	usedKeys map[string]bool
}

// NewResolver creates a new resolver with the given context.
func NewResolver(context map[string]interface{}) *Resolver {
	return &Resolver{
		context:  context,
		usedKeys: make(map[string]bool),
	}
}

// GetUsedKeys returns the list of context keys that were accessed during resolution.
func (r *Resolver) GetUsedKeys() []string {
	if len(r.usedKeys) == 0 {
		return nil
	}
	keys := make([]string, 0, len(r.usedKeys))
	for k := range r.usedKeys {
		keys = append(keys, k)
	}
	return keys
}

// referencePattern matches $node_name.path.to.field or $node_name.array[0]
var referencePattern = regexp.MustCompile(`\$([a-zA-Z0-9_-]+)(\.[a-zA-Z0-9_\[\]\.]+)?`)

// ResolveParameters recursively resolves all parameter values in the given map.
// It replaces string values that match the pattern $node_name.path with the actual value
// from the accumulated context.
func (r *Resolver) ResolveParameters(parameters map[string]interface{}) (map[string]interface{}, error) {
	resolved := make(map[string]interface{})

	for key, value := range parameters {
		resolvedValue, err := r.resolveValue(value)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve parameter '%s': %w", key, err)
		}
		resolved[key] = resolvedValue
	}

	return resolved, nil
}

// resolveValue resolves a single value, which can be a string, map, slice, or primitive.
func (r *Resolver) resolveValue(value interface{}) (interface{}, error) {
	if value == nil {
		return nil, nil
	}

	switch v := value.(type) {
	case string:
		return r.resolveString(v)

	case map[string]interface{}:
		// Recursively resolve nested maps
		resolved := make(map[string]interface{})
		for key, val := range v {
			resolvedVal, err := r.resolveValue(val)
			if err != nil {
				return nil, err
			}
			resolved[key] = resolvedVal
		}
		return resolved, nil

	case []interface{}:
		// Recursively resolve slices
		resolved := make([]interface{}, len(v))
		for i, val := range v {
			resolvedVal, err := r.resolveValue(val)
			if err != nil {
				return nil, err
			}
			resolved[i] = resolvedVal
		}
		return resolved, nil

	default:
		// Return primitives as-is (int, float, bool, etc.)
		return value, nil
	}
}

// expressionPattern matches {{ ... }} expression blocks that should not be resolved
var expressionPattern = regexp.MustCompile(`\{\{.*?\}\}`)

// resolveString resolves references in a string value.
// If the entire string is a reference (e.g., "$node.field"), it returns the actual value.
// If the string contains embedded references (e.g., "User: $node.name"), it performs string interpolation.
// Strings containing {{ ... }} expression blocks are returned as-is for later evaluation by nodes like edit.
func (r *Resolver) resolveString(s string) (interface{}, error) {
	// Skip resolution for strings containing {{ ... }} expression blocks
	// These are meant to be evaluated by nodes like the edit node using their own expression engine
	if expressionPattern.MatchString(s) {
		return s, nil
	}

	// Check if the entire string is a single reference
	if strings.HasPrefix(s, "$") && !strings.Contains(s[1:], "$") {
		// Single reference - return the actual value (could be any type)
		value, err := r.resolveReference(s)
		if err != nil {
			return nil, err
		}
		return value, nil
	}

	// String contains embedded references - perform interpolation
	result := referencePattern.ReplaceAllStringFunc(s, func(match string) string {
		value, err := r.resolveReference(match)
		if err != nil {
			// If resolution fails, keep the original reference
			return match
		}
		// Convert resolved value to string for interpolation
		return fmt.Sprintf("%v", value)
	})

	return result, nil
}

// resolveReference resolves a single reference like $node_name.path.to.field
func (r *Resolver) resolveReference(ref string) (interface{}, error) {
	if !strings.HasPrefix(ref, "$") {
		return ref, nil
	}

	// Remove the $ prefix
	path := ref[1:]

	// Split into node name and field path
	parts := strings.SplitN(path, ".", 2)
	nodeName := parts[0]

	// Track usage for the resolved node key (context keys are stored with the $ prefix)
	if r.usedKeys != nil {
		r.usedKeys["$"+nodeName] = true
	}

	// Get the node data from context
	nodeData, ok := r.context["$"+nodeName]
	if !ok {
		return nil, fmt.Errorf("node '%s' not found in context", nodeName)
	}

	// If there's no field path, return the entire node data
	if len(parts) == 1 {
		return nodeData, nil
	}

	// Navigate the field path
	fieldPath := parts[1]
	return r.navigatePath(nodeData, fieldPath)
}

// navigatePath navigates a nested path like "body.values[0].val"
func (r *Resolver) navigatePath(data interface{}, path string) (interface{}, error) {
	current := data
	segments := r.parsePathSegments(path)

	for i, segment := range segments {
		// Handle array index access
		if segment.isArray {
			current = r.getArrayElement(current, segment.arrayIndex)
			if current == nil {
				return nil, fmt.Errorf("array index %d out of bounds at segment %d", segment.arrayIndex, i)
			}
			continue
		}

		// Handle field access
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

// pathSegment represents a single segment in a path
type pathSegment struct {
	field      string
	isArray    bool
	arrayIndex int
}

// parsePathSegments parses a path like "body.values[0].val" into segments
func (r *Resolver) parsePathSegments(path string) []pathSegment {
	var segments []pathSegment
	parts := strings.Split(path, ".")

	for _, part := range parts {
		// Check if this part has array indexing
		if idx := strings.Index(part, "["); idx != -1 {
			// Extract field name and array index
			field := part[:idx]
			indexStr := part[idx+1 : len(part)-1] // Remove [ and ]
			arrayIndex, _ := strconv.Atoi(indexStr)

			// Add field segment
			if field != "" {
				segments = append(segments, pathSegment{
					field:   field,
					isArray: false,
				})
			}

			// Add array index segment
			segments = append(segments, pathSegment{
				isArray:    true,
				arrayIndex: arrayIndex,
			})
		} else {
			// Simple field access
			segments = append(segments, pathSegment{
				field:   part,
				isArray: false,
			})
		}
	}

	return segments
}

// getArrayElement safely gets an element from an array/slice
func (r *Resolver) getArrayElement(data interface{}, index int) interface{} {
	val := reflect.ValueOf(data)

	if val.Kind() != reflect.Slice && val.Kind() != reflect.Array {
		return nil
	}

	if index < 0 || index >= val.Len() {
		return nil
	}

	return val.Index(index).Interface()
}
