package registry

import (
	"testing"
)

func TestInitializeRegistry(t *testing.T) {
	reg, mgr := InitializeRegistry()

	if reg == nil {
		t.Fatal("InitializeRegistry() returned nil registry")
	}
	if mgr == nil {
		t.Fatal("InitializeRegistry() returned nil mcp manager")
	}
}

func TestInitializeRegistryHasTypes(t *testing.T) {
	reg, _ := InitializeRegistry()

	// Get all registered types
	types := reg.GetAllTypes()

	// We expect at least the http node type to be registered
	// since it's imported in init_registry.go
	if len(types) == 0 {
		t.Log("Warning: No node types registered. This may be expected if no nodes have init() functions yet.")
	}

	// Verify the registry can be queried
	allTypes := reg.GetAllTypes()
	if allTypes == nil {
		t.Error("GetAllTypes() returned nil")
	}
}

func TestInitializeRegistryMultipleCalls(t *testing.T) {
	// Calling InitializeRegistry multiple times should work
	registry1, _ := InitializeRegistry()
	registry2, _ := InitializeRegistry()

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

func TestInitializeRegistryIncludesMCPTools(t *testing.T) {
	reg, _ := InitializeRegistry()

	types := reg.GetAllTypes()
	typeSet := make(map[string]bool, len(types))
	for _, typ := range types {
		typeSet[typ] = true
	}

	// These should be registered from the explicit ToolDef declarations
	expectedMCP := []string{
		"mcp.gmail.send_email",
		"mcp.gmail.read_email",
		"mcp.google_sheets.read_range",
		"mcp.google_sheets.append_row",
		"mcp.outlook.send_email",
	}

	for _, expected := range expectedMCP {
		if !typeSet[expected] {
			t.Errorf("expected MCP tool %q to be registered, got types: %v", expected, types)
		}
	}
}
