package mcp

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
)

// Manager orchestrates lazy MCP provider connections.
// Providers are created from the global integration configs at startup,
// but connections are established on-demand when a workflow node executes.
type Manager struct {
	providers map[string]*Provider
	configs   map[string]IntegrationConfig
	mu        sync.RWMutex
}

// NewManager creates a manager from the globally registered integrations.
// No connections are opened here — they happen lazily on first use.
func NewManager() *Manager {
	configs := RegisteredIntegrations()
	m := &Manager{
		providers: make(map[string]*Provider, len(configs)),
		configs:   make(map[string]IntegrationConfig, len(configs)),
	}
	for _, cfg := range configs {
		if cfg.URL != "" {
			m.configs[cfg.Name] = cfg
		}
	}
	return m
}

// GetOrConnect returns an existing connected provider, or lazily connects
// to the MCP server on first use. This is the primary entry point used
// by MCPNode during workflow execution.
func (m *Manager) GetOrConnect(ctx context.Context, name string) (*Provider, error) {
	// Fast path: already connected
	m.mu.RLock()
	p, exists := m.providers[name]
	m.mu.RUnlock()

	if exists && p.IsConnected() {
		return p, nil
	}

	// Slow path: connect
	m.mu.Lock()
	defer m.mu.Unlock()

	// Double-check after acquiring write lock
	if p, exists := m.providers[name]; exists && p.IsConnected() {
		return p, nil
	}

	cfg, ok := m.configs[name]
	if !ok {
		return nil, fmt.Errorf("mcp integration %q not configured", name)
	}

	p = NewProvider(name)
	if err := p.ConnectHTTP(ctx, cfg.URL); err != nil {
		return nil, fmt.Errorf("mcp connect %s: %w", name, err)
	}

	m.providers[name] = p
	slog.Info("mcp provider connected on-demand", "provider", name)
	return p, nil
}

// GetProvider returns a provider by name (nil if not yet connected).
func (m *Manager) GetProvider(name string) *Provider {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.providers[name]
}

// ProviderCount returns the number of currently connected providers.
func (m *Manager) ProviderCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.providers)
}

// DisconnectAll closes all active MCP sessions.
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
