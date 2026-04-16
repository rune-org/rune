package lognode

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"rune-worker/pkg/nodes"
	"rune-worker/plugin"
)

type LogNode struct {
	message string
	level   string
	nodeID  string
}

func NewLogNode(execCtx plugin.ExecutionContext) *LogNode {
	node := &LogNode{level: "info", nodeID: execCtx.NodeID}
	if message, ok := execCtx.Parameters["message"].(string); ok {
		node.message = message
	}
	if level, ok := execCtx.Parameters["level"].(string); ok && strings.TrimSpace(level) != "" {
		node.level = strings.ToLower(strings.TrimSpace(level))
	}
	return node
}

func (n *LogNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	if strings.TrimSpace(n.message) == "" {
		return nil, fmt.Errorf("message parameter is required")
	}

	attrs := []any{
		"workflow_id", execCtx.WorkflowID,
		"execution_id", execCtx.ExecutionID,
		"node_id", n.nodeID,
	}

	switch n.level {
	case "debug":
		slog.DebugContext(ctx, n.message, attrs...)
	case "warn":
		slog.WarnContext(ctx, n.message, attrs...)
	case "error":
		slog.ErrorContext(ctx, n.message, attrs...)
	default:
		n.level = "info"
		slog.InfoContext(ctx, n.message, attrs...)
	}

	return map[string]any{
		"message":   n.message,
		"level":     n.level,
		"logged_at": time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func init() {
	nodes.RegisterNodeType(RegisterLog)
}

func RegisterLog(reg *nodes.Registry) {
	reg.Register("log", func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewLogNode(execCtx)
	})
}
