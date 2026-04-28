package mcp

import (
	"fmt"
	"sync"

	"rune-worker/pkg/nodes"
	"rune-worker/plugin"
)

// ToolDef describes a single MCP tool that developers have explicitly
// wrapped after inspecting the remote MCP server during development.
// Only tools listed here will be available as workflow nodes.
type ToolDef struct {
	// MCPName is the tool name on the remote MCP server (e.g. "send_email").
	MCPName string

	// NodeName is the custom workflow node suffix (e.g. "send_email").
	// The full node type becomes "mcp.<integration>.<NodeName>".
	// If empty, MCPName is used.
	NodeName string

	// Description is a human-readable description shown in the DSL/frontend.
	Description string
}

// FullNodeName returns the name used for node registration.
func (t ToolDef) FullNodeName() string {
	if t.NodeName != "" {
		return t.NodeName
	}
	return t.MCPName
}

// IntegrationConfig defines a single MCP-backed integration with
// explicitly declared tools.
type IntegrationConfig struct {
	Name  string    // unique id, used as node namespace (e.g. "gmail")
	URL   string    // MCP server endpoint (e.g. "http://gmail-mcp:3200/mcp")
	Tools []ToolDef // explicitly wrapped tools
}

// NodeRegistry is satisfied by nodes.Registry.
type NodeRegistry interface {
	Register(nodeType string, factory nodes.Factory)
}

// NodeType returns the full node type for a tool in this integration.
func (c IntegrationConfig) NodeType(toolDef ToolDef) string {
	return fmt.Sprintf("mcp.%s.%s", c.Name, toolDef.FullNodeName())
}

var (
	registryMu   sync.Mutex
	integrations []IntegrationConfig
)

// RegisterIntegration adds an integration to the global list.
// Called from init() in each integration package.
func RegisterIntegration(cfg IntegrationConfig) {
	registryMu.Lock()
	defer registryMu.Unlock()
	integrations = append(integrations, cfg)
}

// RegisteredIntegrations returns a copy of all registered integrations.
func RegisteredIntegrations() []IntegrationConfig {
	registryMu.Lock()
	defer registryMu.Unlock()
	out := make([]IntegrationConfig, len(integrations))
	copy(out, integrations)
	return out
}

// RegisterAllTools registers workflow nodes for all explicitly defined tools
// across all integrations. This is called once during startup — no MCP
// connection or auto-discovery needed.
func RegisterAllTools(registry NodeRegistry, mgr *Manager) int {
	configs := RegisteredIntegrations()
	total := 0

	for _, cfg := range configs {
		for _, tool := range cfg.Tools {
			nodeType := cfg.NodeType(tool)
			providerName := cfg.Name
			mcpToolName := tool.MCPName

			registry.Register(nodeType, func(execCtx plugin.ExecutionContext) plugin.Node {
				return NewMCPNode(mgr, providerName, mcpToolName, execCtx)
			})
			total++
		}
	}
	return total
}

// ResetIntegrations clears the global list (tests only).
func ResetIntegrations() {
	registryMu.Lock()
	defer registryMu.Unlock()
	integrations = nil
}
