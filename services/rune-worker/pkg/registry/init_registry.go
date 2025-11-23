package registry

import (
	"log/slog"

	"rune-worker/pkg/nodes"
	// Import all node packages to trigger their init() functions
	_ "rune-worker/pkg/nodes/custom/conditional"
	_ "rune-worker/pkg/nodes/custom/http"
	_ "rune-worker/pkg/nodes/custom/smtp"
	_ "rune-worker/pkg/nodes/custom/switch"
)

// InitializeRegistry creates and populates the node registry with all available node types.
// All nodes that have registered themselves via nodes.RegisterNodeType in their init()
// functions will be automatically included.
func InitializeRegistry() *nodes.Registry {
	registry := nodes.NewRegistry()

	// Apply all auto-registered node types
	nodes.ApplyRegistrations(registry)

	// Log registered node types at debug level
	for _, nodeType := range registry.GetAllTypes() {
		slog.Debug("registered node type", "type", nodeType)
	}

	return registry
}
