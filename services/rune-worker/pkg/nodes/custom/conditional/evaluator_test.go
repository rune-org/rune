package conditional

import (
	"testing"
)

func TestEvaluator_SimpleBooleanTrue(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{})
	result, err := eval.Evaluate("true")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !result {
		t.Error("Expected true, got false")
	}
}

func TestEvaluator_SimpleBooleanFalse(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{})
	result, err := eval.Evaluate("false")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if result {
		t.Error("Expected false, got true")
	}
}

func TestEvaluator_EqualityOperator(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{
		"$value": 42,
	})
	result, err := eval.Evaluate("$value == 42")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !result {
		t.Error("Expected true for 42 == 42")
	}
}

func TestEvaluator_NotEqualOperator(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{
		"$value": 42,
	})
	result, err := eval.Evaluate("$value != 100")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !result {
		t.Error("Expected true for 42 != 100")
	}
}

func TestEvaluator_GreaterThan(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{
		"$value": 50,
	})
	result, err := eval.Evaluate("$value > 30")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !result {
		t.Error("Expected true for 50 > 30")
	}
}

func TestEvaluator_LessThan(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{
		"$value": 20,
	})
	result, err := eval.Evaluate("$value < 30")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !result {
		t.Error("Expected true for 20 < 30")
	}
}

func TestEvaluator_GreaterOrEqual(t *testing.T) {
	tests := []struct {
		name     string
		value    int
		expected bool
	}{
		{"Greater", 50, true},
		{"Equal", 30, true},
		{"Less", 20, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			eval := NewEvaluator(map[string]interface{}{
				"$value": tt.value,
			})
			result, err := eval.Evaluate("$value >= 30")

			if err != nil {
				t.Fatalf("Expected no error, got %v", err)
			}

			if result != tt.expected {
				t.Errorf("Expected %v for %d >= 30, got %v", tt.expected, tt.value, result)
			}
		})
	}
}

func TestEvaluator_LessOrEqual(t *testing.T) {
	tests := []struct {
		name     string
		value    int
		expected bool
	}{
		{"Less", 20, true},
		{"Equal", 30, true},
		{"Greater", 40, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			eval := NewEvaluator(map[string]interface{}{
				"$value": tt.value,
			})
			result, err := eval.Evaluate("$value <= 30")

			if err != nil {
				t.Fatalf("Expected no error, got %v", err)
			}

			if result != tt.expected {
				t.Errorf("Expected %v for %d <= 30, got %v", tt.expected, tt.value, result)
			}
		})
	}
}

func TestEvaluator_ContainsOperator(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{
		"$message": "hello world",
	})
	result, err := eval.Evaluate("$message contains 'world'")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !result {
		t.Error("Expected true for contains operator")
	}
}

func TestEvaluator_ContainsOperatorFalse(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{
		"$message": "hello world",
	})
	result, err := eval.Evaluate("$message contains 'goodbye'")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if result {
		t.Error("Expected false for contains operator with non-matching string")
	}
}

func TestEvaluator_AndOperator(t *testing.T) {
	tests := []struct {
		name     string
		val1     bool
		val2     bool
		expected bool
	}{
		{"Both true", true, true, true},
		{"First false", false, true, false},
		{"Second false", true, false, false},
		{"Both false", false, false, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			eval := NewEvaluator(map[string]interface{}{
				"$val1": tt.val1,
				"$val2": tt.val2,
			})
			result, err := eval.Evaluate("$val1 == true and $val2 == true")

			if err != nil {
				t.Fatalf("Expected no error, got %v", err)
			}

			if result != tt.expected {
				t.Errorf("Expected %v for %v and %v, got %v", tt.expected, tt.val1, tt.val2, result)
			}
		})
	}
}

func TestEvaluator_OrOperator(t *testing.T) {
	tests := []struct {
		name     string
		val1     bool
		val2     bool
		expected bool
	}{
		{"Both true", true, true, true},
		{"First true", true, false, true},
		{"Second true", false, true, true},
		{"Both false", false, false, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			eval := NewEvaluator(map[string]interface{}{
				"$val1": tt.val1,
				"$val2": tt.val2,
			})
			result, err := eval.Evaluate("$val1 == true or $val2 == true")

			if err != nil {
				t.Fatalf("Expected no error, got %v", err)
			}

			if result != tt.expected {
				t.Errorf("Expected %v for %v or %v, got %v", tt.expected, tt.val1, tt.val2, result)
			}
		})
	}
}

func TestEvaluator_NotOperator(t *testing.T) {
	tests := []struct {
		name     string
		value    bool
		expected bool
	}{
		{"Not true", true, false},
		{"Not false", false, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			eval := NewEvaluator(map[string]interface{}{
				"$value": tt.value,
			})
			result, err := eval.Evaluate("not $value")

			if err != nil {
				t.Fatalf("Expected no error, got %v", err)
			}

			if result != tt.expected {
				t.Errorf("Expected %v for not %v, got %v", tt.expected, tt.value, result)
			}
		})
	}
}

func TestEvaluator_NotOperatorWithExclamation(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{
		"$value": false,
	})
	result, err := eval.Evaluate("!$value")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !result {
		t.Error("Expected true for !false")
	}
}

func TestEvaluator_NestedFieldAccess(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{
		"$response": map[string]interface{}{
			"status": 200,
			"body": map[string]interface{}{
				"message": "success",
			},
		},
	})
	result, err := eval.Evaluate("$response.status == 200")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !result {
		t.Error("Expected true for nested field access")
	}
}

func TestEvaluator_DeepNestedFieldAccess(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{
		"$response": map[string]interface{}{
			"body": map[string]interface{}{
				"user": map[string]interface{}{
					"name": "John",
				},
			},
		},
	})
	result, err := eval.Evaluate("$response.body.user.name == 'John'")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !result {
		t.Error("Expected true for deep nested field access")
	}
}

func TestEvaluator_StringComparison(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{
		"$env": "production",
	})
	result, err := eval.Evaluate("$env == 'production'")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !result {
		t.Error("Expected true for string comparison")
	}
}

func TestEvaluator_NumericStringLiteral(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{})
	result, err := eval.Evaluate("100 > 50")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !result {
		t.Error("Expected true for 100 > 50")
	}
}

func TestEvaluator_ComplexExpression(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{
		"$status": 200,
		"$body":   "success",
		"$retry":  false,
	})
	// (200 == 200 and "success" contains "success") or false
	// (true and true) or false
	// true or false
	// true
	result, err := eval.Evaluate("$status == 200 and $body contains 'success' or $retry == true")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !result {
		t.Error("Expected true for complex expression")
	}
}

func TestEvaluator_EmptyExpression(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{})
	_, err := eval.Evaluate("")

	if err == nil {
		t.Error("Expected error for empty expression")
	}
}

func TestEvaluator_InvalidReference(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{})
	_, err := eval.Evaluate("$nonexistent == 200")

	if err == nil {
		t.Error("Expected error for invalid reference")
	}
}

func TestEvaluator_InvalidNestedField(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{
		"$response": map[string]interface{}{
			"status": 200,
		},
	})
	_, err := eval.Evaluate("$response.nonexistent == 200")

	if err == nil {
		t.Error("Expected error for invalid nested field")
	}
}

func TestEvaluator_InvalidComparisonType(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{
		"$value": "text",
	})
	_, err := eval.Evaluate("$value > 100")

	if err == nil {
		t.Error("Expected error for invalid comparison type")
	}
}

func TestEvaluator_QuotedStrings(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		expected   bool
	}{
		{"Single quotes", "'hello' == 'hello'", true},
		{"Double quotes", `"hello" == "hello"`, true},
		{"Mixed quotes", `'hello' == "hello"`, true},
		{"Not equal", "'hello' == 'world'", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			eval := NewEvaluator(map[string]interface{}{})
			result, err := eval.Evaluate(tt.expression)

			if err != nil {
				t.Fatalf("Expected no error, got %v", err)
			}

			if result != tt.expected {
				t.Errorf("Expected %v for expression %s, got %v", tt.expected, tt.expression, result)
			}
		})
	}
}

func TestEvaluator_NullComparison(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{
		"$value": nil,
	})
	result, err := eval.Evaluate("$value == null")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !result {
		t.Error("Expected true for null comparison")
	}
}

func TestEvaluator_BooleanContext(t *testing.T) {
	tests := []struct {
		name     string
		value    interface{}
		expected bool
	}{
		{"True boolean", true, true},
		{"False boolean", false, false},
		{"Non-empty string", "text", true},
		{"Empty string", "", false},
		{"Non-zero number", 42, true},
		{"Zero", 0, false},
		{"Nil", nil, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			eval := NewEvaluator(map[string]interface{}{
				"$value": tt.value,
			})
			result, err := eval.Evaluate("$value")

			if err != nil {
				t.Fatalf("Expected no error, got %v", err)
			}

			if result != tt.expected {
				t.Errorf("Expected %v for %v in boolean context, got %v", tt.expected, tt.value, result)
			}
		})
	}
}

func TestEvaluator_ArrayIndexing(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{
		"$items": map[string]interface{}{
			"list": []interface{}{"first", "second", "third"},
		},
	})
	result, err := eval.Evaluate("$items.list[1] == 'second'")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !result {
		t.Error("Expected true for array indexing")
	}
}

func TestEvaluator_ArrayIndexOutOfBounds(t *testing.T) {
	eval := NewEvaluator(map[string]interface{}{
		"$items": map[string]interface{}{
			"list": []interface{}{"first", "second"},
		},
	})
	_, err := eval.Evaluate("$items.list[10] == 'value'")

	if err == nil {
		t.Error("Expected error for array index out of bounds")
	}
}

func TestEvaluator_OperatorPrecedence(t *testing.T) {
	// Test that AND has higher precedence than OR
	// false or true and false
	// false or (true and false)
	// false or false
	// false
	eval := NewEvaluator(map[string]interface{}{})
	result, err := eval.Evaluate("false or true and false")

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if result {
		t.Error("Expected false due to operator precedence (AND before OR)")
	}
}

func TestEvaluator_StatusCodeRanges(t *testing.T) {
	tests := []struct {
		name       string
		status     int
		expression string
		expected   bool
	}{
		{"2xx success", 200, "$status >= 200 and $status < 300", true},
		{"4xx error", 404, "$status >= 400 and $status < 500", true},
		{"5xx error", 500, "$status >= 500 and $status < 600", true},
		{"Not 4xx", 200, "$status >= 400 and $status < 500", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			eval := NewEvaluator(map[string]interface{}{
				"$status": tt.status,
			})
			result, err := eval.Evaluate(tt.expression)

			if err != nil {
				t.Fatalf("Expected no error, got %v", err)
			}

			if result != tt.expected {
				t.Errorf("Expected %v for status %d with expression %s, got %v",
					tt.expected, tt.status, tt.expression, result)
			}
		})
	}
}
