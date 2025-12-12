package switchnode

import (
	"fmt"
	"strconv"
	"strings"
)

// Evaluator evaluates rules against a context.
type Evaluator struct {
	context map[string]interface{}
}

// NewEvaluator creates a new evaluator with the given context.
func NewEvaluator(context map[string]interface{}) *Evaluator {
	return &Evaluator{
		context: context,
	}
}

// EvaluateRule evaluates a single rule.
func (e *Evaluator) EvaluateRule(value string, operator string, compareValue interface{}) (bool, error) {
	// Resolve the left side value
	leftVal, err := e.resolveValue(value)
	if err != nil {
		return false, fmt.Errorf("failed to resolve value '%s': %w", value, err)
	}

	// Resolve the right side value (compareValue)
	// compareValue might be a literal or a reference string
	var rightVal interface{}
	if strVal, ok := compareValue.(string); ok {
		rightVal, err = e.resolveValue(strVal)
		if err != nil {
			return false, fmt.Errorf("failed to resolve compare value '%s': %w", strVal, err)
		}
	} else {
		rightVal = compareValue
	}

	return e.compare(leftVal, rightVal, operator)
}

// resolveValue resolves a value from the context or parses it as a literal
func (e *Evaluator) resolveValue(value string) (interface{}, error) {
	value = strings.TrimSpace(value)

	// Check if it's a quoted string
	if (strings.HasPrefix(value, `"`) && strings.HasSuffix(value, `"`)) ||
		(strings.HasPrefix(value, `'`) && strings.HasSuffix(value, `'`)) {
		return value[1 : len(value)-1], nil
	}

	// Check if it's a reference to context (e.g., $node.field or {{ $node.field }})
	if strings.HasPrefix(value, "{{") && strings.HasSuffix(value, "}}") {
		value = strings.TrimSpace(value[2 : len(value)-2])
	}

	if strings.HasPrefix(value, "$") {
		return e.resolveReference(value)
	}

	// Try to parse as number
	if num, err := strconv.ParseFloat(value, 64); err == nil {
		return num, nil
	}

	// Try to parse as boolean
	if value == "true" {
		return true, nil
	}
	if value == "false" {
		return false, nil
	}

	// Try to parse as null/nil
	if value == "null" || value == "nil" {
		return nil, nil
	}

	// Otherwise, treat as a literal string
	return value, nil
}

// resolveReference resolves a reference like $node.field from context
func (e *Evaluator) resolveReference(ref string) (interface{}, error) {
	if !strings.HasPrefix(ref, "$") {
		return ref, nil
	}

	// Remove the $ prefix
	path := ref[1:]

	// Split into node name and field path
	parts := strings.SplitN(path, ".", 2)
	nodeName := parts[0]

	// Get the node data from context
	nodeData, ok := e.context["$"+nodeName]
	if !ok {
		// Try looking up in top-level context directly (e.g. $input)
		if val, ok := e.context[ref]; ok {
			return val, nil
		}
		return nil, fmt.Errorf("node '%s' not found in context", nodeName)
	}

	// If there's no field path, return the entire node data
	if len(parts) == 1 {
		return nodeData, nil
	}

	// Navigate the field path
	fieldPath := parts[1]
	return navigatePath(nodeData, fieldPath)
}

// navigatePath navigates a nested path like "body.user.name"
func navigatePath(data interface{}, path string) (interface{}, error) {
	current := data
	parts := strings.Split(path, ".")

	for _, part := range parts {
		// Handle array indexing
		if idx := strings.Index(part, "["); idx != -1 {
			fieldName := part[:idx]
			indexStr := part[idx+1 : len(part)-1]
			index, err := strconv.Atoi(indexStr)
			if err != nil {
				return nil, fmt.Errorf("invalid array index: %s", indexStr)
			}

			// Get the field first
			if fieldName != "" {
				currentMap, ok := current.(map[string]interface{})
				if !ok {
					return nil, fmt.Errorf("cannot access field '%s' on non-object type", fieldName)
				}
				current = currentMap[fieldName]
			}

			// Access array element
			arr, ok := current.([]interface{})
			if !ok {
				return nil, fmt.Errorf("cannot index non-array type")
			}
			if index < 0 || index >= len(arr) {
				return nil, fmt.Errorf("array index out of bounds: %d", index)
			}
			current = arr[index]
			continue
		}

		// Handle regular field access
		currentMap, ok := current.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("cannot access field '%s' on non-object type", part)
		}

		value, ok := currentMap[part]
		if !ok {
			return nil, fmt.Errorf("field '%s' not found", part)
		}

		current = value
	}

	return current, nil
}

// compare compares two values using the given operator
func (e *Evaluator) compare(left, right interface{}, operator string) (bool, error) {
	operator = strings.TrimSpace(operator)
	switch operator {
	case "==", "is equal to":
		return compareEqual(left, right), nil
	case "!=", "is not equal to":
		return !compareEqual(left, right), nil
	case ">", "is greater than":
		return compareGreater(left, right)
	case "<", "is less than":
		return compareLess(left, right)
	case ">=", "is greater than or equal to":
		return compareGreaterOrEqual(left, right)
	case "<=", "is less than or equal to":
		return compareLessOrEqual(left, right)
	case "contains":
		return compareContains(left, right)
	default:
		return false, fmt.Errorf("unsupported operator: %s", operator)
	}
}

// compareEqual checks if two values are equal
func compareEqual(left, right interface{}) bool {
	// Handle nil cases
	if left == nil && right == nil {
		return true
	}
	if left == nil || right == nil {
		return false
	}

	// Convert to comparable types
	leftStr := fmt.Sprintf("%v", left)
	rightStr := fmt.Sprintf("%v", right)

	// Try numeric comparison
	leftNum, leftErr := strconv.ParseFloat(leftStr, 64)
	rightNum, rightErr := strconv.ParseFloat(rightStr, 64)
	if leftErr == nil && rightErr == nil {
		return leftNum == rightNum
	}

	// String comparison
	return leftStr == rightStr
}

// compareGreater checks if left > right
func compareGreater(left, right interface{}) (bool, error) {
	leftNum, rightNum, err := toNumbers(left, right)
	if err != nil {
		return false, err
	}
	return leftNum > rightNum, nil
}

// compareLess checks if left < right
func compareLess(left, right interface{}) (bool, error) {
	leftNum, rightNum, err := toNumbers(left, right)
	if err != nil {
		return false, err
	}
	return leftNum < rightNum, nil
}

// compareGreaterOrEqual checks if left >= right
func compareGreaterOrEqual(left, right interface{}) (bool, error) {
	leftNum, rightNum, err := toNumbers(left, right)
	if err != nil {
		return false, err
	}
	return leftNum >= rightNum, nil
}

// compareLessOrEqual checks if left <= right
func compareLessOrEqual(left, right interface{}) (bool, error) {
	leftNum, rightNum, err := toNumbers(left, right)
	if err != nil {
		return false, err
	}
	return leftNum <= rightNum, nil
}

// compareContains checks if left contains right (for strings)
func compareContains(left, right interface{}) (bool, error) {
	leftStr := fmt.Sprintf("%v", left)
	rightStr := fmt.Sprintf("%v", right)
	return strings.Contains(leftStr, rightStr), nil
}

// toNumbers converts two values to numbers
func toNumbers(left, right interface{}) (float64, float64, error) {
	leftStr := fmt.Sprintf("%v", left)
	rightStr := fmt.Sprintf("%v", right)

	leftNum, err := strconv.ParseFloat(leftStr, 64)
	if err != nil {
		return 0, 0, fmt.Errorf("cannot convert '%v' to number", left)
	}

	rightNum, err := strconv.ParseFloat(rightStr, 64)
	if err != nil {
		return 0, 0, fmt.Errorf("cannot convert '%v' to number", right)
	}

	return leftNum, rightNum, nil
}
