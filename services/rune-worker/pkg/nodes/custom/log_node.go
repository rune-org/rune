package custom

import (
	"context"
	"log/slog"

	"rune-worker/pkg/nodes"
	"rune-worker/plugin"
)

// LogNode emits messages to the structured logger.
type LogNode struct{}

// Execute writes the provided payload to the log output.
func (n *LogNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	slog.Info("log node executed", "workflow_id", execCtx.WorkflowID, "node_id", execCtx.NodeID, "input", execCtx.Input)
	return execCtx.Input, nil
}

// RegisterLog registers the log node type with the registry.
func RegisterLog(reg *nodes.Registry) {
	reg.Register("log", func(execCtx plugin.ExecutionContext) plugin.Node {
		return &LogNode{}
	})
}
