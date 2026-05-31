package datetimeformat

import (
	"context"
	"fmt"
	"strings"
	"time"

	"rune-worker/pkg/nodes"
	"rune-worker/pkg/nodes/shared/datetimeops"
	"rune-worker/plugin"
)

type Node struct {
	date     string
	timezone string
	format   string
}

func New(execCtx plugin.ExecutionContext) *Node {
	node := &Node{
		timezone: "UTC",
		format:   datetimeops.DefaultFormat,
	}
	if date, ok := execCtx.Parameters["date"].(string); ok {
		node.date = date
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
	if strings.TrimSpace(n.date) == "" {
		return nil, fmt.Errorf("date parameter is required")
	}
	loc, err := datetimeops.LoadLocation(n.timezone)
	if err != nil {
		return nil, err
	}
	parsed, err := datetimeops.ParseDateInLocation(n.date, loc, n.format)
	if err != nil {
		return nil, err
	}
	result := parsed.In(loc)
	formatted := result.Format(n.format)
	return map[string]any{
		"result":   formatted,
		"iso":      result.Format(time.RFC3339),
		"unix":     result.Unix(),
		"timezone": loc.String(),
	}, nil
}

func init() {
	nodes.RegisterNodeType(Register)
}

func Register(reg *nodes.Registry) {
	reg.Register("dateTimeFormat", func(execCtx plugin.ExecutionContext) plugin.Node {
		return New(execCtx)
	})
}
