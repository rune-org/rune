package nodes

import (
	"fmt"
	"sync"
	"rune-worker/plugin"
)

// Factory creates a Node using the provided execution context.
type Factory func(plugin.ExecutionContext) plugin.Node

// Registry maintains a mapping between node types and their factories.
type Registry struct {
	mu        sync.RWMutex
	factories map[string]Factory
}

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
