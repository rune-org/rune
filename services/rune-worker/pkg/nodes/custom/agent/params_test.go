package agent

import (
	"testing"
)

func TestParseParams_RejectsMissingProvider(t *testing.T) {
	_, err := parseParams(map[string]any{})
	if err == nil {
		t.Fatal("expected error when model is missing, got nil")
	}
}

func TestParseParams_RejectsUnsupportedToolType(t *testing.T) {
	raw := map[string]any{
		"model": map[string]any{"provider": "gemini", "name": "gemini-flash-latest"},
		"tools": []any{
			map[string]any{"type": "shell", "name": "x", "config": map[string]any{}},
		},
	}
	_, err := parseParams(raw)
	if err == nil {
		t.Fatal("expected error for unsupported tool type")
	}
}

func TestParseParams_HappyPath(t *testing.T) {
	raw := map[string]any{
		"model": map[string]any{
			"provider":    "gemini",
			"name":        "gemini-flash-latest",
			"backend":     "vertex",
			"temperature": 0.5,
		},
		"system_prompt": "You are helpful.",
		"messages": []any{
			map[string]any{"role": "user", "content": "Hello"},
		},
		"tools": []any{
			map[string]any{
				"type":        "http_request",
				"name":        "get_weather",
				"description": "Get the weather",
				"config": map[string]any{
					"method": "GET",
					"url":    map[string]any{"mode": "fixed", "value": "https://example.com"},
					"body": []any{
						map[string]any{
							"key": "city",
							"value": map[string]any{
								"mode":  "agent",
								"agent": map[string]any{"description": "city name", "type": "string", "required": true},
							},
						},
					},
				},
			},
		},
		"mcp_servers": []any{
			map[string]any{
				"name":      "github",
				"transport": "streamable_http",
				"url":       "https://example.com/mcp",
			},
		},
	}
	p, err := parseParams(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.Model.Provider != "gemini" || p.Model.Name != "gemini-flash-latest" {
		t.Errorf("unexpected model: %+v", p.Model)
	}
	if p.Model.Backend != "vertex" {
		t.Errorf("expected backend \"vertex\", got %q", p.Model.Backend)
	}
	if p.Model.Temperature == nil || *p.Model.Temperature != 0.5 {
		t.Errorf("expected temperature 0.5, got %+v", p.Model.Temperature)
	}
	if len(p.Messages) != 1 || p.Messages[0].Role != "user" {
		t.Errorf("unexpected messages: %+v", p.Messages)
	}
	if len(p.Tools) != 1 || p.Tools[0].Name != "get_weather" || p.Tools[0].HTTP == nil {
		t.Fatalf("unexpected tools: %+v", p.Tools)
	}
	if len(p.Tools[0].HTTP.Body) != 1 || p.Tools[0].HTTP.Body[0].Value.Mode != "agent" {
		t.Errorf("expected one agent body slot, got %+v", p.Tools[0].HTTP.Body)
	}
	if len(p.MCPServers) != 1 || p.MCPServers[0].URL != "https://example.com/mcp" {
		t.Errorf("unexpected mcp servers: %+v", p.MCPServers)
	}
}
