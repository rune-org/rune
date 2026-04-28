package mcp

import (
	"context"
	"log/slog"
	"sync"

	"rune-worker/plugin"
)

// Manager orchestrates MCP provider connections and tool registration.
type Manager struct {
	providers map[string]*Provider
	mu        sync.RWMutex
}

// NewManager creates a manager from the globally registered integrations.
func NewManager() *Manager {
	configs := RegisteredIntegrations()
	m := &Manager{providers: make(map[string]*Provider, len(configs))}
	for _, cfg := range configs {
		if cfg.URL != "" {
			m.providers[cfg.Name] = NewProvider(cfg.Name)
		}
	}
	return m
}

// ConnectAll connects to all configured MCP servers concurrently.
// Partial failures are logged but don't block startup.
func (m *Manager) ConnectAll(ctx context.Context) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.providers) == 0 {
		return
	}

	configs := RegisteredIntegrations()
	urlMap := make(map[string]string)
	for _, cfg := range configs {
		urlMap[cfg.Name] = cfg.URL
	}

	var wg sync.WaitGroup
	for name, p := range m.providers {
		url := urlMap[name]
		if url == "" {
			continue
		}
		wg.Add(1)
		go func(p *Provider, url string) {
			defer wg.Done()
			if err := p.ConnectHTTP(ctx, url); err != nil {
				slog.Error("mcp connect failed", "provider", p.Name(), "error", err)
			}
		}(p, url)
	}
	wg.Wait()
}

// RegisterTools discovers tools from all connected providers
// and registers them as workflow nodes.
func (m *Manager) RegisterTools(ctx context.Context, registry NodeRegistry) int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	configs := RegisteredIntegrations()
	cfgMap := make(map[string]IntegrationConfig)
	for _, cfg := range configs {
		cfgMap[cfg.Name] = cfg
	}

	total := 0
	for _, p := range m.providers {
		if !p.IsConnected() {
			continue
		}

		tools, err := p.DiscoverTools(ctx)
		if err != nil {
			slog.Error("mcp tool discovery failed", "provider", p.Name(), "error", err)
			continue
		}

		cfg := cfgMap[p.Name()]
		for _, tool := range tools {
			nodeType := cfg.NodeType(tool.Name)
			toolName := tool.Name
			providerName := p.Name()

			registry.Register(nodeType, func(execCtx plugin.ExecutionContext) plugin.Node {
				return NewMCPNode(m, providerName, toolName, execCtx)
			})
		}
		total += len(tools)
	}

	slog.Info("mcp tools registered", "count", total)
	return total
}

// GetProvider returns a provider by name.
func (m *Manager) GetProvider(name string) *Provider {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.providers[name]
}

// ProviderCount returns the number of configured providers.
func (m *Manager) ProviderCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.providers)
}

// DisconnectAll closes all MCP sessions.
func (m *Manager) DisconnectAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, p := range m.providers {
		p.Disconnect()
	}
}

// AddProvider adds a provider directly (tests only).
func (m *Manager) AddProvider(p *Provider) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.providers[p.Name()] = p
}
