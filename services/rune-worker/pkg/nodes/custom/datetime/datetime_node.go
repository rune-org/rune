package datetimenode

import (
	"context"
	"fmt"
	"strings"
	"time"

	"rune-worker/pkg/nodes"
	"rune-worker/pkg/nodes/shared/listops"
	"rune-worker/plugin"
)

type DateTimeNode struct {
	operation string
	date      string
	amount    int
	hasAmount bool
	unit      string
	format    string
	timezone  string
	now       func() time.Time
}

func NewDateTimeNode(execCtx plugin.ExecutionContext) *DateTimeNode {
	node := &DateTimeNode{
		operation: "now",
		unit:      "days",
		format:    time.RFC3339,
		timezone:  "UTC",
		now:       time.Now,
	}
	if operation, ok := execCtx.Parameters["operation"].(string); ok && strings.TrimSpace(operation) != "" {
		node.operation = strings.ToLower(strings.TrimSpace(operation))
	}
	if date, ok := execCtx.Parameters["date"].(string); ok {
		node.date = date
	}
	if amount, ok := listops.ToInt(execCtx.Parameters["amount"]); ok {
		node.amount = amount
		node.hasAmount = true
	}
	if unit, ok := execCtx.Parameters["unit"].(string); ok && strings.TrimSpace(unit) != "" {
		node.unit = strings.ToLower(strings.TrimSpace(unit))
	}
	if format, ok := execCtx.Parameters["format"].(string); ok && strings.TrimSpace(format) != "" {
		node.format = format
	}
	if timezone, ok := execCtx.Parameters["timezone"].(string); ok && strings.TrimSpace(timezone) != "" {
		node.timezone = timezone
	}
	return node
}

func (n *DateTimeNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	_ = ctx
	loc, err := time.LoadLocation(n.timezone)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone: %w", err)
	}

	var result time.Time
	switch n.operation {
	case "now":
		result = n.now().In(loc)
	case "add", "subtract", "format":
		if strings.TrimSpace(n.date) == "" {
			return nil, fmt.Errorf("date parameter is required for %s", n.operation)
		}
		if (n.operation == "add" || n.operation == "subtract") && !n.hasAmount {
			return nil, fmt.Errorf("amount parameter is required for %s", n.operation)
		}
		parsed, err := parseInputTime(n.date, loc)
		if err != nil {
			return nil, err
		}
		result = parsed.In(loc)
		if n.operation == "add" || n.operation == "subtract" {
			result, err = applyOffset(result, n.amount, n.unit, n.operation == "subtract")
			if err != nil {
				return nil, err
			}
		}
	default:
		return nil, fmt.Errorf("unsupported operation: %s", n.operation)
	}

	formatted := result.Format(n.format)
	return map[string]any{
		"result":    formatted,
		"formatted": formatted,
		"unix":      result.Unix(),
		"timezone":  loc.String(),
		"operation": n.operation,
	}, nil
}

func parseInputTime(value string, loc *time.Location) (time.Time, error) {
	value = strings.TrimSpace(value)
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02",
		time.RFC1123Z,
		time.RFC1123,
		time.RFC822Z,
		time.RFC822,
	}
	for _, format := range formats {
		var parsed time.Time
		var err error
		if strings.Contains(format, "Z07:00") || strings.Contains(format, "MST") || strings.Contains(format, "-0700") {
			parsed, err = time.Parse(format, value)
		} else {
			parsed, err = time.ParseInLocation(format, value, loc)
		}
		if err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported date value: %s", value)
}

func applyOffset(input time.Time, amount int, unit string, negate bool) (time.Time, error) {
	if negate {
		amount = -amount
	}
	switch unit {
	case "seconds":
		return input.Add(time.Duration(amount) * time.Second), nil
	case "minutes":
		return input.Add(time.Duration(amount) * time.Minute), nil
	case "hours":
		return input.Add(time.Duration(amount) * time.Hour), nil
	case "days":
		return input.AddDate(0, 0, amount), nil
	case "weeks":
		return input.AddDate(0, 0, amount*7), nil
	case "months":
		return input.AddDate(0, amount, 0), nil
	case "years":
		return input.AddDate(amount, 0, 0), nil
	default:
		return time.Time{}, fmt.Errorf("unsupported unit: %s", unit)
	}
}

func init() {
	nodes.RegisterNodeType(RegisterDateTime)
}

func RegisterDateTime(reg *nodes.Registry) {
	reg.Register("datetime", func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewDateTimeNode(execCtx)
	})
}
