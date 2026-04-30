package mcp

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"rune-worker/plugin"
)

// MCPNode wraps a remote MCP tool call as a workflow node.
// The MCP connection is established lazily on first Execute().
type MCPNode struct {
	manager      *Manager
	providerName string
	toolName     string
	arguments    map[string]any
	timeout      time.Duration
}

// NewMCPNode builds an MCPNode from the execution context.
func NewMCPNode(manager *Manager, provider, tool string, execCtx plugin.ExecutionContext) *MCPNode {
	n := &MCPNode{
		manager:      manager,
		providerName: provider,
		toolName:     tool,
		arguments:    make(map[string]any),
		timeout:      60 * time.Second,
	}

	// Support both explicit "arguments" map and flat params.
	if args, ok := execCtx.Parameters["arguments"].(map[string]interface{}); ok {
		for k, v := range args {
			n.arguments[k] = v
		}
	} else {
		for k, v := range execCtx.Parameters {
			if k != "timeout" && k != "arguments" {
				n.arguments[k] = v
			}
		}
	}

	if t, ok := execCtx.Parameters["timeout"].(float64); ok && t > 0 {
		n.timeout = time.Duration(t) * time.Second
	}
	return n
}

// Execute connects to the MCP server on-demand and calls the wrapped tool.
func (n *MCPNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	slog.Info("mcp call",
		"provider", n.providerName,
		"tool", n.toolName,
		"node_id", execCtx.NodeID,
	)

	// Lazy connect — opens the MCP session if this is the first call
	// to this provider in the current worker lifecycle.
	p, err := n.manager.GetOrConnect(ctx, n.providerName)
	if err != nil {
		return nil, fmt.Errorf("mcp provider %q: %w", n.providerName, err)
	}

	callCtx, cancel := context.WithTimeout(ctx, n.timeout)
	defer cancel()

	result, err := p.CallTool(callCtx, n.toolName, n.arguments)
	if err != nil {
		return nil, fmt.Errorf("mcp %s.%s: %w", n.providerName, n.toolName, err)
	}

	return ExtractResult(result), nil
}
