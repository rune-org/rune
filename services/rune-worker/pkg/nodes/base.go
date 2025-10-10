package nodes

import (
	"fmt"
	"rune-worker/plugin"
	"sync"
)

// Factory creates a Node using the provided execution context.
type Factory func(plugin.ExecutionContext) plugin.Node

// Registry maintains a mapping between node types and their factories.
type Registry struct {
	mu        sync.RWMutex
	factories map[string]Factory
}

// globalRegistry is the default package-level registry instance.
var globalRegistry = NewRegistry()

// NewRegistry creates an empty registry instance.
func NewRegistry() *Registry {
	return &Registry{factories: make(map[string]Factory)}
}

// Register associates a node type with a factory.
func (r *Registry) Register(nodeType string, factory Factory) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.factories[nodeType] = factory
}

// Create instantiates a node by type.
func (r *Registry) Create(nodeType string, ctx plugin.ExecutionContext) (plugin.Node, error) {
	r.mu.RLock()
	factory, ok := r.factories[nodeType]
	r.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("node type %s not registered", nodeType)
	}

	return factory(ctx), nil
}

// GetAllTypes returns a list of all registered node types.
func (r *Registry) GetAllTypes() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	types := make([]string, 0, len(r.factories))
	for nodeType := range r.factories {
		types = append(types, nodeType)
	}
	return types
}

// RegisterNode registers a node type with its factory in the global registry.
// This is a thread-safe operation that allows registration of node implementations
// by their type name (e.g., "http", "conditional", "log").
//
// Parameters:
//   - nodeType: The unique identifier for the node type (e.g., "http", "conditional")
//   - factory: A function that creates a new instance of the node
//
// Example:
//
//	RegisterNode("http", func(ctx plugin.ExecutionContext) plugin.Node {
//	    return &HTTPNode{}
//	})
func RegisterNode(nodeType string, factory Factory) {
	globalRegistry.Register(nodeType, factory)
}

// GetNode retrieves a node factory from the global registry by its type name.
// This is a thread-safe operation that returns the factory function for creating
// instances of the specified node type.
//
// Parameters:
//   - nodeType: The unique identifier for the node type (e.g., "http", "conditional")
//
// Returns:
//   - Factory: The factory function for creating the node
//   - error: An error if the node type is not registered
//
// Example:
//
//	factory, err := GetNode("http")
//	if err != nil {
//	    log.Fatal(err)
//	}
//	node := factory(execCtx)
func GetNode(nodeType string, ctx plugin.ExecutionContext) (plugin.Node, error) {
	return globalRegistry.Create(nodeType, ctx)
}

// GetGlobalRegistry returns the global registry instance.
// This can be used for advanced operations or testing purposes.
func GetGlobalRegistry() *Registry {
	return globalRegistry
}
