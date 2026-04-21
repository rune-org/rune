package datetimenow

import (
	"context"
	"strings"
	"time"

	"rune-worker/pkg/nodes"
	"rune-worker/pkg/nodes/shared/datetimeops"
	"rune-worker/plugin"
)

type Node struct {
	timezone string
	format   string
	now      func() time.Time
}

func New(execCtx plugin.ExecutionContext) *Node {
	node := &Node{
		timezone: "UTC",
		format:   datetimeops.DefaultFormat,
		now:      time.Now,
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
	loc, err := datetimeops.LoadLocation(n.timezone)
	if err != nil {
		return nil, err
	}
	result := n.now().In(loc)
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
	reg.Register("dateTimeNow", func(execCtx plugin.ExecutionContext) plugin.Node {
		return New(execCtx)
	})
}
