package mcp

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"rune-worker/plugin"
)

// MCPNode wraps a remote MCP tool call as a workflow node.
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

// Execute calls the remote MCP tool and returns the result.
func (n *MCPNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	slog.Info("mcp call",
		"provider", n.providerName,
		"tool", n.toolName,
		"node_id", execCtx.NodeID,
	)

	p := n.manager.GetProvider(n.providerName)
	if p == nil {
		return nil, fmt.Errorf("mcp provider %q not found", n.providerName)
	}
	if !p.IsConnected() {
		return nil, fmt.Errorf("mcp provider %q not connected", n.providerName)
	}

	callCtx, cancel := context.WithTimeout(ctx, n.timeout)
	defer cancel()

	result, err := p.CallTool(callCtx, n.toolName, n.arguments)
	if err != nil {
		return nil, fmt.Errorf("mcp %s.%s: %w", n.providerName, n.toolName, err)
	}

	return ExtractResult(result), nil
}
