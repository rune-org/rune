package mcp

import (
	"context"
	"encoding/json"
	"testing"

	"rune-worker/pkg/nodes"
	"rune-worker/plugin"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// startTestServer creates an in-memory MCP server with test tools.
// Returns the client-side transport to connect to it.
func startTestServer(t *testing.T, ctx context.Context) mcp.Transport {
	t.Helper()

	server := mcp.NewServer(&mcp.Implementation{Name: "test-server"}, nil)

	server.AddTool(
		&mcp.Tool{
			Name:        "echo",
			Description: "returns the input message",
			InputSchema: json.RawMessage(`{"type":"object"}`),
		},
		func(_ context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			var args map[string]any
			if req.Params.Arguments != nil {
				json.Unmarshal(req.Params.Arguments, &args)
			}
			msg, _ := args["message"].(string)
			return &mcp.CallToolResult{
				Content: []mcp.Content{&mcp.TextContent{Text: msg}},
			}, nil
		},
	)

	server.AddTool(
		&mcp.Tool{
			Name:        "add",
			Description: "adds two numbers",
			InputSchema: json.RawMessage(`{"type":"object"}`),
		},
		func(_ context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			var args map[string]any
			json.Unmarshal(req.Params.Arguments, &args)
			a, _ := args["a"].(float64)
			b, _ := args["b"].(float64)
			result, _ := json.Marshal(map[string]float64{"sum": a + b})
			return &mcp.CallToolResult{
				Content: []mcp.Content{&mcp.TextContent{Text: string(result)}},
			}, nil
		},
	)

	st, ct := mcp.NewInMemoryTransports()
	if _, err := server.Connect(ctx, st, nil); err != nil {
		t.Fatalf("server connect: %v", err)
	}
	return ct
}

func TestProviderConnect(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	transport := startTestServer(t, ctx)

	p := NewProvider("test")
	if err := p.Connect(ctx, transport); err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer p.Disconnect()

	if !p.IsConnected() {
		t.Fatal("expected connected")
	}
}

func TestProviderDiscoverTools(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	transport := startTestServer(t, ctx)

	p := NewProvider("test")
	if err := p.Connect(ctx, transport); err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer p.Disconnect()

	tools, err := p.DiscoverTools(ctx)
	if err != nil {
		t.Fatalf("discover: %v", err)
	}
	if len(tools) != 2 {
		t.Fatalf("expected 2 tools, got %d", len(tools))
	}

	names := map[string]bool{}
	for _, tool := range tools {
		names[tool.Name] = true
	}
	if !names["echo"] || !names["add"] {
		t.Errorf("expected echo and add tools, got %v", names)
	}
}

func TestProviderCallTool(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	transport := startTestServer(t, ctx)

	p := NewProvider("test")
	if err := p.Connect(ctx, transport); err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer p.Disconnect()

	result, err := p.CallTool(ctx, "echo", map[string]any{"message": "hello"})
	if err != nil {
		t.Fatalf("call: %v", err)
	}
	if len(result.Content) == 0 {
		t.Fatal("empty result content")
	}
	tc, ok := result.Content[0].(*mcp.TextContent)
	if !ok {
		t.Fatal("expected TextContent")
	}
	if tc.Text != "hello" {
		t.Errorf("expected 'hello', got %q", tc.Text)
	}
}

func TestExtractResultJSON(t *testing.T) {
	result := &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{Text: `{"sum":42}`},
		},
	}

	out := ExtractResult(result)
	if out["is_error"] != false {
		t.Error("expected is_error=false")
	}
	data, ok := out["data"].(map[string]any)
	if !ok {
		t.Fatalf("expected map data, got %T", out["data"])
	}
	if data["sum"] != 42.0 {
		t.Errorf("expected sum=42, got %v", data["sum"])
	}
}

func TestExtractResultPlainText(t *testing.T) {
	result := &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{Text: "plain text response"},
		},
	}

	out := ExtractResult(result)
	if out["data"] != "plain text response" {
		t.Errorf("expected plain text, got %v", out["data"])
	}
}

func TestMCPNodeExecute(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	transport := startTestServer(t, ctx)

	p := NewProvider("test")
	if err := p.Connect(ctx, transport); err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer p.Disconnect()

	m := &Manager{
		providers: map[string]*Provider{"test": p},
		configs:   map[string]IntegrationConfig{},
	}

	execCtx := plugin.ExecutionContext{
		NodeID:     "node_1",
		Type:       "mcp.test.echo",
		Parameters: map[string]interface{}{"message": "world"},
	}

	node := NewMCPNode(m, "test", "echo", execCtx)
	out, err := node.Execute(ctx, execCtx)
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if out["data"] != "world" {
		t.Errorf("expected 'world', got %v", out["data"])
	}
}

func TestMCPNodeExecuteJSON(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	transport := startTestServer(t, ctx)

	p := NewProvider("test")
	if err := p.Connect(ctx, transport); err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer p.Disconnect()

	m := &Manager{
		providers: map[string]*Provider{"test": p},
		configs:   map[string]IntegrationConfig{},
	}

	execCtx := plugin.ExecutionContext{
		NodeID: "node_2",
		Type:   "mcp.test.add",
		Parameters: map[string]interface{}{
			"arguments": map[string]interface{}{
				"a": 10.0,
				"b": 32.0,
			},
		},
	}

	node := NewMCPNode(m, "test", "add", execCtx)
	out, err := node.Execute(ctx, execCtx)
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	data, ok := out["data"].(map[string]any)
	if !ok {
		t.Fatalf("expected map, got %T", out["data"])
	}
	if data["sum"] != 42.0 {
		t.Errorf("expected sum=42, got %v", data["sum"])
	}
}

func TestRegisterAllTools(t *testing.T) {
	ResetIntegrations()
	defer ResetIntegrations()

	RegisterIntegration(IntegrationConfig{
		Name: "test",
		URL:  "http://test:3000/mcp",
		Tools: []ToolDef{
			{MCPName: "echo", Description: "echo tool"},
			{MCPName: "add", Description: "add tool"},
		},
	})

	m := NewManager()
	reg := &testRegistry{types: map[string]bool{}}
	count := RegisterAllTools(reg, m)

	if count != 2 {
		t.Fatalf("expected 2 registered tools, got %d", count)
	}
	if !reg.types["mcp.test.echo"] {
		t.Error("expected mcp.test.echo to be registered")
	}
	if !reg.types["mcp.test.add"] {
		t.Error("expected mcp.test.add to be registered")
	}
}

func TestToolDefCustomNodeName(t *testing.T) {
	ResetIntegrations()
	defer ResetIntegrations()

	RegisterIntegration(IntegrationConfig{
		Name: "test",
		URL:  "http://test:3000/mcp",
		Tools: []ToolDef{
			{MCPName: "send_email_v2", NodeName: "send_email", Description: "send email"},
		},
	})

	m := NewManager()
	reg := &testRegistry{types: map[string]bool{}}
	count := RegisterAllTools(reg, m)

	if count != 1 {
		t.Fatalf("expected 1 registered tool, got %d", count)
	}
	if !reg.types["mcp.test.send_email"] {
		t.Error("expected mcp.test.send_email to be registered (custom NodeName)")
	}
	if reg.types["mcp.test.send_email_v2"] {
		t.Error("should NOT register under raw MCPName when NodeName is set")
	}
}

func TestNodeType(t *testing.T) {
	cfg := IntegrationConfig{Name: "google_sheets", URL: "http://test:3000/mcp"}

	tool := ToolDef{MCPName: "write_cell"}
	if got := cfg.NodeType(tool); got != "mcp.google_sheets.write_cell" {
		t.Errorf("got %q", got)
	}

	toolAliased := ToolDef{MCPName: "write_cell_v2", NodeName: "write_cell"}
	if got := cfg.NodeType(toolAliased); got != "mcp.google_sheets.write_cell" {
		t.Errorf("got %q", got)
	}
}

func TestIntegrationRegistry(t *testing.T) {
	ResetIntegrations()
	defer ResetIntegrations()

	RegisterIntegration(IntegrationConfig{
		Name: "a",
		URL:  "http://a:3000/mcp",
		Tools: []ToolDef{
			{MCPName: "tool1"},
		},
	})
	RegisterIntegration(IntegrationConfig{
		Name: "b",
		URL:  "http://b:3000/mcp",
		Tools: []ToolDef{
			{MCPName: "tool2"},
		},
	})

	list := RegisteredIntegrations()
	if len(list) != 2 {
		t.Fatalf("expected 2, got %d", len(list))
	}
	if list[0].Name != "a" || list[1].Name != "b" {
		t.Errorf("unexpected names: %v", list)
	}
}

type testRegistry struct {
	types map[string]bool
}

func (r *testRegistry) Register(nodeType string, _ nodes.Factory) {
	r.types[nodeType] = true
}
