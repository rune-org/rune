package integrations

import (
	"context"
	"fmt"
	"testing"
	"time"

	"rune-worker/plugin"
)

type testTool struct {
	kind string
}

func (t testTool) Kind() string { return t.kind }

func (t testTool) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	return map[string]any{"kind": t.kind}, nil
}

func TestRegisterAndLookup(t *testing.T) {
	kind := fmt.Sprintf("integration.test.%d", time.Now().UnixNano())
	Register(testTool{kind: kind})

	tool, ok := get(kind)
	if !ok {
		t.Fatalf("expected tool %q to be registered", kind)
	}
	if tool.Kind() != kind {
		t.Fatalf("registered tool kind = %q, want %q", tool.Kind(), kind)
	}
}

func TestIntegrationNodeExecuteByType(t *testing.T) {
	kind := fmt.Sprintf("integration.test.execute.%d", time.Now().UnixNano())
	Register(testTool{kind: kind})

	n := &integrationNode{kind: kind}
	out, err := n.Execute(context.Background(), plugin.ExecutionContext{Type: kind})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if out["kind"] != kind {
		t.Fatalf("unexpected output kind: %v", out["kind"])
	}
}

func TestIntegrationNodeUnknownKind(t *testing.T) {
	n := &integrationNode{kind: "integration.unknown.kind"}
	_, err := n.Execute(context.Background(), plugin.ExecutionContext{})
	if err == nil {
		t.Fatal("expected error for unknown integration kind")
	}
}

func TestRegisterDuplicatePanics(t *testing.T) {
	kind := fmt.Sprintf("integration.test.dup.%d", time.Now().UnixNano())
	Register(testTool{kind: kind})

	defer func() {
		if recover() == nil {
			t.Fatal("expected panic for duplicate kind")
		}
	}()
	Register(testTool{kind: kind})
}
