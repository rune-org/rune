package integrations

import (
	"context"
	"fmt"
	"sync"

	"rune-worker/pkg/nodes"
	"rune-worker/plugin"
)

// Tool is a stateless integration tool handler.
type Tool interface {
	Kind() string
	Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error)
}

var (
	registryMu sync.RWMutex
	registry   = make(map[string]Tool)
)

// Register stores a tool in the integrations registry and wires it into the
// global node registration queue for node factory creation.
func Register(t Tool) {
	kind := t.Kind()
	if kind == "" {
		panic("integrations: empty kind")
	}

	registryMu.Lock()
	if _, exists := registry[kind]; exists {
		registryMu.Unlock()
		panic("integrations: duplicate kind " + kind)
	}
	registry[kind] = t
	registryMu.Unlock()

	nodes.RegisterNodeType(func(reg *nodes.Registry) {
		reg.Register(kind, newIntegrationNode)
	})
}

func get(kind string) (Tool, bool) {
	registryMu.RLock()
	defer registryMu.RUnlock()
	t, ok := registry[kind]
	return t, ok
}

type integrationNode struct {
	kind string
}

func newIntegrationNode(ec plugin.ExecutionContext) plugin.Node {
	return &integrationNode{kind: ec.Type}
}

func (n *integrationNode) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	t, ok := get(n.kind)
	if !ok {
		return nil, fmt.Errorf("integration not registered: %s", n.kind)
	}
	return t.Execute(ctx, ec)
}
