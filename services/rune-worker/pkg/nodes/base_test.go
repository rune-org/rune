package nodes_test

import (
	"context"
	"sync"
	"testing"

	"rune-worker/pkg/core"
	"rune-worker/pkg/nodes"
	"rune-worker/plugin"
)

// MockNode is a simple node implementation for testing
type MockNode struct {
	Type string
}

func (m *MockNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	return map[string]any{"type": m.Type}, nil
}

func TestRegisterNode(t *testing.T) {
	// Create a new registry for isolated testing
	reg := nodes.NewRegistry()

	// Register a mock node
	reg.Register(core.NodeTypeMock, func(execCtx plugin.ExecutionContext) plugin.Node {
		return &MockNode{Type: core.NodeTypeMock}
	})

	// Create a node instance
	execCtx := plugin.ExecutionContext{
		NodeID:     "test-node",
		WorkflowID: "test-workflow",
	}

	node, err := reg.Create(core.NodeTypeMock, execCtx)
	if err != nil {
		t.Fatalf("Failed to create node: %v", err)
	}

	if node == nil {
		t.Fatal("Expected non-nil node")
	}

	// Execute the node
	result, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Failed to execute node: %v", err)
	}

	if result["type"] != core.NodeTypeMock {
		t.Errorf("Expected type '%s', got '%v'", core.NodeTypeMock, result["type"])
	}
}

func TestGetNodeNotRegistered(t *testing.T) {
	reg := nodes.NewRegistry()
	execCtx := plugin.ExecutionContext{}

	_, err := reg.Create("nonexistent", execCtx)
	if err == nil {
		t.Fatal("Expected error for unregistered node type")
	}
}

func TestThreadSafeRegistration(t *testing.T) {
	reg := nodes.NewRegistry()
	var wg sync.WaitGroup

	// Concurrently register 10 different node types
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			nodeType := string(rune('a' + idx))
			reg.Register(nodeType, func(execCtx plugin.ExecutionContext) plugin.Node {
				return &MockNode{Type: nodeType}
			})
		}(i)
	}

	wg.Wait()

	// Verify all nodes were registered
	types := reg.GetAllTypes()
	if len(types) != 10 {
		t.Errorf("Expected 10 registered types, got %d", len(types))
	}
}

func TestThreadSafeRetrieval(t *testing.T) {
	reg := nodes.NewRegistry()

	// Register a node
	reg.Register(core.NodeTypeConcurrent, func(execCtx plugin.ExecutionContext) plugin.Node {
		return &MockNode{Type: core.NodeTypeConcurrent}
	})

	var wg sync.WaitGroup
	execCtx := plugin.ExecutionContext{}

	// Concurrently retrieve the same node type multiple times
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			node, err := reg.Create(core.NodeTypeConcurrent, execCtx)
			if err != nil {
				t.Errorf("Failed to create node: %v", err)
				return
			}
			if node == nil {
				t.Error("Expected non-nil node")
			}
		}()
	}

	wg.Wait()
}

func TestGlobalRegistryFunctions(t *testing.T) {
	// Note: This test uses the global registry, so it may be affected by other tests
	// In production, consider resetting the global registry between tests if needed

	// Register using the global function
	nodes.RegisterNode("global-test", func(execCtx plugin.ExecutionContext) plugin.Node {
		return &MockNode{Type: "global-test"}
	})

	// Retrieve using the global function
	execCtx := plugin.ExecutionContext{
		NodeID:     "global-node",
		WorkflowID: "global-workflow",
	}

	node, err := nodes.GetNode("global-test", execCtx)
	if err != nil {
		t.Fatalf("Failed to get node from global registry: %v", err)
	}

	if node == nil {
		t.Fatal("Expected non-nil node from global registry")
	}

	// Execute to verify functionality
	result, err := node.Execute(context.Background(), execCtx)
	if err != nil {
		t.Fatalf("Failed to execute node: %v", err)
	}

	if result["type"] != "global-test" {
		t.Errorf("Expected type 'global-test', got '%v'", result["type"])
	}
}

func TestGetAllTypes(t *testing.T) {
	reg := nodes.NewRegistry()

	// Register multiple node types
	nodeTypes := []string{core.NodeTypeHTTP, core.NodeTypeConditional, "log", "email"}
	for _, nodeType := range nodeTypes {
		reg.Register(nodeType, func(execCtx plugin.ExecutionContext) plugin.Node {
			return &MockNode{Type: nodeType}
		})
	}

	// Get all registered types
	registeredTypes := reg.GetAllTypes()

	if len(registeredTypes) != len(nodeTypes) {
		t.Errorf("Expected %d types, got %d", len(nodeTypes), len(registeredTypes))
	}

	// Verify all types are present
	typeMap := make(map[string]bool)
	for _, typ := range registeredTypes {
		typeMap[typ] = true
	}

	for _, expected := range nodeTypes {
		if !typeMap[expected] {
			t.Errorf("Expected type '%s' not found in registered types", expected)
		}
	}
}
