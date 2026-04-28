package mcp

import (
	"fmt"
	"sync"

	"rune-worker/pkg/nodes"
)

// IntegrationConfig defines a single MCP-backed integration.
type IntegrationConfig struct {
	Name string // unique id, used as node namespace (e.g. "google_sheets")
	URL  string // MCP server endpoint (e.g. "http://google-sheets-mcp:3100/mcp")
}

// NodeRegistry is satisfied by nodes.Registry.
type NodeRegistry interface {
	Register(nodeType string, factory nodes.Factory)
}

// NodeType returns the full node type for a tool in this integration.
func (c IntegrationConfig) NodeType(tool string) string {
	return fmt.Sprintf("mcp.%s.%s", c.Name, tool)
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

// ResetIntegrations clears the global list (tests only).
func ResetIntegrations() {
	registryMu.Lock()
	defer registryMu.Unlock()
	integrations = nil
}
