package conditional

import (
	"fmt"
	"strconv"
	"strings"
)

// Evaluator evaluates simple boolean expressions.
// Supports: ==, !=, >, <, >=, <=, contains, and, or, not
type Evaluator struct {
	context map[string]interface{}
}

// NewEvaluator creates a new expression evaluator with the given context.
func NewEvaluator(context map[string]interface{}) *Evaluator {
	return &Evaluator{
		context: context,
	}
}

// Evaluate evaluates the expression and returns the boolean result.
func (e *Evaluator) Evaluate(expression string) (bool, error) {
	expression = strings.TrimSpace(expression)
	if expression == "" {
		return false, fmt.Errorf("empty expression")
	}

	// Handle logical operators (OR has lower precedence than AND)
	if result, handled, err := e.handleLogicalOr(expression); handled {
		return result, err
	}

	// Handle AND
	if result, handled, err := e.handleLogicalAnd(expression); handled {
		return result, err
	}

	// Handle NOT
	if strings.HasPrefix(expression, "not ") || strings.HasPrefix(expression, "!") {
		return e.handleNot(expression)
	}

	// Handle comparison operators
	return e.evaluateComparison(expression)
}

// handleLogicalOr handles OR expressions
func (e *Evaluator) handleLogicalOr(expression string) (bool, bool, error) {
	// Split by " or " (with spaces to avoid matching "or" in variable names)
	parts := splitByOperator(expression, " or ")
	if len(parts) <= 1 {
		return false, false, nil
	}

	// OR: return true if any part is true
	for _, part := range parts {
		result, err := e.Evaluate(part)
		if err != nil {
			return false, true, err
		}
		if result {
			return true, true, nil
		}
	}
	return false, true, nil
}

// handleLogicalAnd handles AND expressions
func (e *Evaluator) handleLogicalAnd(expression string) (bool, bool, error) {
	// Split by " and " (with spaces to avoid matching "and" in variable names)
	parts := splitByOperator(expression, " and ")
	if len(parts) <= 1 {
		return false, false, nil
	}

	// AND: return false if any part is false
	for _, part := range parts {
		result, err := e.Evaluate(part)
		if err != nil {
			return false, true, err
		}
		if !result {
			return false, true, nil
		}
	}
	return true, true, nil
}

// handleNot handles NOT expressions
func (e *Evaluator) handleNot(expression string) (bool, error) {
	var innerExpr string
	if strings.HasPrefix(expression, "not ") {
		innerExpr = strings.TrimSpace(expression[4:])
	} else if strings.HasPrefix(expression, "!") {
		innerExpr = strings.TrimSpace(expression[1:])
	}

	result, err := e.Evaluate(innerExpr)
	if err != nil {
		return false, err
	}
	return !result, nil
}

// evaluateComparison evaluates comparison expressions
func (e *Evaluator) evaluateComparison(expression string) (bool, error) {
	// Try each operator in order of specificity
	operators := []string{">=", "<=", "==", "!=", ">", "<", " contains "}

	for _, op := range operators {
		if strings.Contains(expression, op) {
			parts := strings.SplitN(expression, op, 2)
			if len(parts) != 2 {
				continue
			}

			left := strings.TrimSpace(parts[0])
			right := strings.TrimSpace(parts[1])

			leftVal, err := e.resolveValue(left)
			if err != nil {
				return false, err
			}

			rightVal, err := e.resolveValue(right)
			if err != nil {
				return false, err
			}

			return e.compare(leftVal, rightVal, op)
		}
	}

	// If no operator found, try to resolve as a boolean value
	val, err := e.resolveValue(expression)
	if err != nil {
		return false, err
	}

	// Convert to boolean
	return toBool(val), nil
}

// resolveValue resolves a value from the context or parses it as a literal
func (e *Evaluator) resolveValue(value string) (interface{}, error) {
	value = strings.TrimSpace(value)

	// Check if it's a quoted string
	if (strings.HasPrefix(value, `"`) && strings.HasSuffix(value, `"`)) ||
		(strings.HasPrefix(value, `'`) && strings.HasSuffix(value, `'`)) {
		return value[1 : len(value)-1], nil
	}

	// Check if it's a reference to context (e.g., $node.field)
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
	switch operator {
	case "==":
		return compareEqual(left, right), nil
	case "!=":
		return !compareEqual(left, right), nil
	case ">":
		return compareGreater(left, right)
	case "<":
		return compareLess(left, right)
	case ">=":
		return compareGreaterOrEqual(left, right)
	case "<=":
		return compareLessOrEqual(left, right)
	case " contains ":
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

// toBool converts a value to boolean
func toBool(val interface{}) bool {
	if val == nil {
		return false
	}

	switch v := val.(type) {
	case bool:
		return v
	case string:
		return v != "" && v != "false" && v != "0"
	case int, int8, int16, int32, int64:
		return v != 0
	case uint, uint8, uint16, uint32, uint64:
		return v != 0
	case float32, float64:
		return v != 0
	default:
		return true // Non-empty values are truthy
	}
}

// splitByOperator splits an expression by an operator, respecting quotes
func splitByOperator(expression, operator string) []string {
	var parts []string
	var current strings.Builder
	inQuotes := false
	quoteChar := rune(0)

	i := 0
	for i < len(expression) {
		char := rune(expression[i])

		// Handle quotes
		if char == '"' || char == '\'' {
			if !inQuotes {
				inQuotes = true
				quoteChar = char
			} else if char == quoteChar {
				inQuotes = false
				quoteChar = 0
			}
			current.WriteRune(char)
			i++
			continue
		}

		// Check for operator only if not in quotes
		if !inQuotes && strings.HasPrefix(expression[i:], operator) {
			parts = append(parts, strings.TrimSpace(current.String()))
			current.Reset()
			i += len(operator)
			continue
		}

		current.WriteRune(char)
		i++
	}

	// Add the last part
	if current.Len() > 0 {
		parts = append(parts, strings.TrimSpace(current.String()))
	}

	return parts
}
