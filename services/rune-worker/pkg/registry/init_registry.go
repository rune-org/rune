package registry

import (
	"log/slog"

	"rune-worker/pkg/mcp"
	"rune-worker/pkg/nodes"

	// Import all node packages to trigger their init() functions
	_ "rune-worker/pkg/nodes/custom/aggregator"
	_ "rune-worker/pkg/nodes/custom/conditional"
	_ "rune-worker/pkg/nodes/custom/datetime_add"
	_ "rune-worker/pkg/nodes/custom/datetime_format"
	_ "rune-worker/pkg/nodes/custom/datetime_now"
	_ "rune-worker/pkg/nodes/custom/datetime_parse"
	_ "rune-worker/pkg/nodes/custom/datetime_subtract"
	_ "rune-worker/pkg/nodes/custom/edit"
	_ "rune-worker/pkg/nodes/custom/filter"
	_ "rune-worker/pkg/nodes/custom/http"
	_ "rune-worker/pkg/nodes/custom/limit"
	_ "rune-worker/pkg/nodes/custom/log"
	_ "rune-worker/pkg/nodes/custom/merge"
	_ "rune-worker/pkg/nodes/custom/smtp"
	_ "rune-worker/pkg/nodes/custom/sort"
	_ "rune-worker/pkg/nodes/custom/split"
	_ "rune-worker/pkg/nodes/custom/switch"
	_ "rune-worker/pkg/nodes/custom/wait"

	// MCP integrations — blank imports trigger init() which registers
	// the integration configs including their tools.
	_ "rune-worker/pkg/mcp/integrations/google"
	_ "rune-worker/pkg/mcp/integrations/microsoft"
)

// InitializeRegistry creates and populates the node registry with all available node types.
// All nodes that have registered themselves via nodes.RegisterNodeType in their init()
// functions will be automatically included.
//
// MCP tools are registered statically from the explicit ToolDef declarations.
// No MCP connections are opened here — connections happen lazily at execution time.
func InitializeRegistry() (*nodes.Registry, *mcp.Manager) {
	registry := nodes.NewRegistry()

	// Apply all auto-registered node types (http, conditional, etc.)
	nodes.ApplyRegistrations(registry)

	// Create the MCP manager (no connections yet — lazy on-demand)
	mcpManager := mcp.NewManager()

	// Register all explicitly declared MCP tools as workflow nodes.
	// This only reads the static ToolDef lists — no MCP server needed.
	mcpCount := mcp.RegisterAllTools(registry, mcpManager)

	// Log registered node types at debug level
	for _, nodeType := range registry.GetAllTypes() {
		slog.Debug("registered node type", "type", nodeType)
	}

	slog.Info("registry initialized",
		"builtin_nodes", len(registry.GetAllTypes())-mcpCount,
		"mcp_tools", mcpCount,
		"total", len(registry.GetAllTypes()),
	)

	return registry, mcpManager
}
