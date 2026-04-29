package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// Provider manages a single MCP client connection.
type Provider struct {
	name    string
	client  *mcp.Client
	session *mcp.ClientSession
	tools   []*mcp.Tool

	mu     sync.RWMutex
	closed bool
}

// NewProvider creates an unconnected provider.
func NewProvider(name string) *Provider {
	return &Provider{
		name:   name,
		client: mcp.NewClient(&mcp.Implementation{Name: "rune-worker"}, nil),
	}
}

// Connect establishes the MCP session over the given transport.
func (p *Provider) Connect(ctx context.Context, transport mcp.Transport) error {
	session, err := p.client.Connect(ctx, transport, nil)
	if err != nil {
		return fmt.Errorf("connect %s: %w", p.name, err)
	}

	p.mu.Lock()
	p.session = session
	p.closed = false
	p.mu.Unlock()

	info := session.InitializeResult()
	slog.Info("mcp provider connected",
		"provider", p.name,
		"server", info.ServerInfo.Name,
	)
	return nil
}

// ConnectHTTP connects to an MCP server via Streamable HTTP.
func (p *Provider) ConnectHTTP(ctx context.Context, url string) error {
	transport := &mcp.StreamableClientTransport{
		Endpoint:   url,
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
	return p.Connect(ctx, transport)
}

// DiscoverTools queries the MCP server for available tools and caches them.
func (p *Provider) DiscoverTools(ctx context.Context) ([]*mcp.Tool, error) {
	if !p.IsConnected() {
		return nil, fmt.Errorf("provider %s: not connected", p.name)
	}

	p.mu.RLock()
	session := p.session
	p.mu.RUnlock()

	var tools []*mcp.Tool
	for tool, err := range session.Tools(ctx, nil) {
		if err != nil {
			return nil, fmt.Errorf("list tools from %s: %w", p.name, err)
		}
		tools = append(tools, tool)
	}

	p.mu.Lock()
	p.tools = tools
	p.mu.Unlock()

	slog.Info("discovered mcp tools", "provider", p.name, "count", len(tools))
	return tools, nil
}

// Tools returns the cached tool list.
func (p *Provider) Tools() []*mcp.Tool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.tools
}

// CallTool invokes a tool on the remote MCP server.
func (p *Provider) CallTool(ctx context.Context, toolName string, args map[string]any) (*mcp.CallToolResult, error) {
	if !p.IsConnected() {
		return nil, fmt.Errorf("provider %s: not connected", p.name)
	}

	p.mu.RLock()
	session := p.session
	p.mu.RUnlock()

	params := &mcp.CallToolParams{
		Name:      toolName,
		Arguments: args,
	}
	return session.CallTool(ctx, params)
}

// Disconnect closes the MCP session.
func (p *Provider) Disconnect() {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.session == nil {
		return
	}

	if err := p.session.Close(); err != nil {
		slog.Warn("error closing mcp session", "provider", p.name, "error", err)
	}
	p.session = nil
	p.tools = nil
	p.closed = true
}

// IsConnected reports whether the provider has an active session.
func (p *Provider) IsConnected() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.session != nil && !p.closed
}

// Name returns the provider's name.
func (p *Provider) Name() string { return p.name }

// ExtractResult converts an MCP CallToolResult into a flat map
// suitable for downstream workflow nodes.
func ExtractResult(result *mcp.CallToolResult) map[string]any {
	out := map[string]any{"is_error": result.IsError}

	if result.StructuredContent != nil {
		out["data"] = result.StructuredContent
		return out
	}

	var texts []string
	for _, c := range result.Content {
		if tc, ok := c.(*mcp.TextContent); ok {
			texts = append(texts, tc.Text)
		}
	}

	switch len(texts) {
	case 0:
		// nothing
	case 1:
		out["text"] = texts[0]
		var parsed any
		if json.Unmarshal([]byte(texts[0]), &parsed) == nil {
			out["data"] = parsed
		} else {
			out["data"] = texts[0]
		}
	default:
		out["text"] = texts
		out["data"] = texts
	}

	return out
}
