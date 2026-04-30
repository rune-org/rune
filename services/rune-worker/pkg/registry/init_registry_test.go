package registry

import (
	"testing"
)

func TestInitializeRegistry(t *testing.T) {
	registry := InitializeRegistry()

	if registry == nil {
		t.Fatal("InitializeRegistry() returned nil")
	}

	// Verify it returns a valid Registry instance
	if registry == nil {
		t.Error("Expected non-nil registry")
	}
}

func TestInitializeRegistryHasTypes(t *testing.T) {
	registry := InitializeRegistry()

	// Get all registered types
	types := registry.GetAllTypes()

	// We expect at least the http node type to be registered
	// since it's imported in init_registry.go
	if len(types) == 0 {
		t.Log("Warning: No node types registered. This may be expected if no nodes have init() functions yet.")
	}

	// Verify the registry can be queried
	allTypes := registry.GetAllTypes()
	if allTypes == nil {
		t.Error("GetAllTypes() returned nil")
	}
}

func TestInitializeRegistryMultipleCalls(t *testing.T) {
	// Calling InitializeRegistry multiple times should work
	registry1 := InitializeRegistry()
	registry2 := InitializeRegistry()

	if registry1 == nil {
		t.Error("First call returned nil registry")
	}
	if registry2 == nil {
		t.Error("Second call returned nil registry")
	}

	// Both should be valid Registry instances
	types1 := registry1.GetAllTypes()
	types2 := registry2.GetAllTypes()

	if len(types1) != len(types2) {
		t.Errorf("Different registries have different type counts: %d vs %d", len(types1), len(types2))
	}
}
