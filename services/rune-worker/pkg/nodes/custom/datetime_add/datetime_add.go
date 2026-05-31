package datetimeadd

import (
	"context"
	"fmt"
	"strings"
	"time"

	"rune-worker/pkg/nodes"
	"rune-worker/pkg/nodes/shared/datetimeops"
	"rune-worker/pkg/nodes/shared/listops"
	"rune-worker/plugin"
)

type Node struct {
	date      string
	amount    int
	hasAmount bool
	unit      string
	timezone  string
	format    string
	now       func() time.Time
}

func New(execCtx plugin.ExecutionContext) *Node {
	node := &Node{
		unit:     "days",
		timezone: "UTC",
		format:   datetimeops.DefaultFormat,
		now:      time.Now,
	}
	if date, ok := execCtx.Parameters["date"].(string); ok {
		node.date = date
	}
	if amount, ok := listops.ToInt(execCtx.Parameters["amount"]); ok {
		node.amount = amount
		node.hasAmount = true
	}
	if unit, ok := execCtx.Parameters["unit"].(string); ok && strings.TrimSpace(unit) != "" {
		node.unit = unit
	}
	if tz, ok := execCtx.Parameters["timezone"].(string); ok && strings.TrimSpace(tz) != "" {
		node.timezone = tz
	}
	if format, ok := execCtx.Parameters["format"].(string); ok && strings.TrimSpace(format) != "" {
		node.format = format
	}
	return node
}

func (n *Node) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	_ = ctx
	_ = execCtx
	if !n.hasAmount {
		return nil, fmt.Errorf("amount parameter is required")
	}
	loc, err := datetimeops.LoadLocation(n.timezone)
	if err != nil {
		return nil, err
	}
	base, err := resolveBase(n.date, loc, n.format, n.now)
	if err != nil {
		return nil, err
	}
	shifted, err := datetimeops.ApplyOffset(base, n.amount, n.unit, false)
	if err != nil {
		return nil, err
	}
	result := shifted.In(loc)
	formatted := result.Format(n.format)
	return map[string]any{
		"result":   formatted,
		"iso":      result.Format(time.RFC3339),
		"unix":     result.Unix(),
		"timezone": loc.String(),
	}, nil
}

func resolveBase(date string, loc *time.Location, format string, now func() time.Time) (time.Time, error) {
	if strings.TrimSpace(date) == "" {
		return now().In(loc), nil
	}
	return datetimeops.ParseDateInLocation(date, loc, format)
}

func init() {
	nodes.RegisterNodeType(Register)
}

func Register(reg *nodes.Registry) {
	reg.Register("dateTimeAdd", func(execCtx plugin.ExecutionContext) plugin.Node {
		return New(execCtx)
	})
}
