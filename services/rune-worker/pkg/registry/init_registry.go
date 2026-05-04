package registry

import (
	"log/slog"

	"rune-worker/pkg/nodes"
	// Import all node packages to trigger their init() functions
	_ "rune-worker/pkg/nodes/custom/agent"
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
