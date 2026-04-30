package datetimeparse

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
}

func New(execCtx plugin.ExecutionContext) *Node {
	node := &Node{timezone: "UTC"}
	if date, ok := execCtx.Parameters["date"].(string); ok {
		node.date = date
	}
	if tz, ok := execCtx.Parameters["timezone"].(string); ok && strings.TrimSpace(tz) != "" {
		node.timezone = tz
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
	parsed, err := datetimeops.ParseDateInLocation(n.date, loc)
	if err != nil {
		return nil, err
	}
	t := parsed.In(loc)
	return map[string]any{
		"unix":     t.Unix(),
		"iso":      t.Format(time.RFC3339),
		"year":     t.Year(),
		"month":    int(t.Month()),
		"day":      t.Day(),
		"hour":     t.Hour(),
		"minute":   t.Minute(),
		"second":   t.Second(),
		"weekday":  t.Weekday().String(),
		"timezone": loc.String(),
	}, nil
}

func init() {
	nodes.RegisterNodeType(Register)
}

func Register(reg *nodes.Registry) {
	reg.Register("dateTimeParse", func(execCtx plugin.ExecutionContext) plugin.Node {
		return New(execCtx)
	})
}
