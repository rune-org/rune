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
	if p := m.GetProvider(name); p != nil && p.IsConnected() {
		return p, nil
	}

	// Slow path: connect
	m.mu.Lock()
	defer m.mu.Unlock()

	// Double-check after acquiring write lock (do not call GetProvider here — RLock while holding Lock deadlocks)
	if p := m.getProviderLocked(name); p != nil && p.IsConnected() {
		return p, nil
	}

	cfg, ok := m.configs[name]
	if !ok {
		return nil, fmt.Errorf("mcp integration %q not configured", name)
	}

	p := NewProvider(name)
	if err := p.ConnectHTTP(ctx, cfg.URL); err != nil {
		return nil, fmt.Errorf("mcp connect %s: %w", name, err)
	}

	m.providers[name] = p
	slog.Info("mcp provider connected on-demand", "provider", name)
	return p, nil
}

// GetProvider returns the cached provider for name, or nil if none has been stored yet.
// The provider may be disconnected; use (*Provider).IsConnected to check.
func (m *Manager) GetProvider(name string) *Provider {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.providers[name]
}

// getProviderLocked returns m.providers[name]; m.mu must be held.
func (m *Manager) getProviderLocked(name string) *Provider {
	return m.providers[name]
}

// ProviderCount returns how many cached providers currently have an active session.
func (m *Manager) ProviderCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	n := 0
	for _, p := range m.providers {
		if p.IsConnected() {
			n++
		}
	}
	return n
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
