package agent

import (
	"fmt"
)

func parseParams(raw map[string]any) (*agentParams, error) {
	p := &agentParams{}

	if mRaw, ok := raw["model"].(map[string]any); ok {
		p.Model.Provider, _ = mRaw["provider"].(string)
		p.Model.Name, _ = mRaw["name"].(string)
		p.Model.Backend, _ = mRaw["backend"].(string)
		if t, ok := asFloat32(mRaw["temperature"]); ok {
			p.Model.Temperature = &t
		}
	}
	if p.Model.Provider == "" {
		return nil, fmt.Errorf("agent: model.provider is required")
	}
	if p.Model.Name == "" {
		return nil, fmt.Errorf("agent: model.name is required")
	}

	if sp, ok := raw["system_prompt"].(string); ok {
		p.SystemPrompt = sp
	}

	if msgsRaw, ok := raw["messages"].([]any); ok {
		for _, m := range msgsRaw {
			mm, ok := m.(map[string]any)
			if !ok {
				continue
			}
			role, _ := mm["role"].(string)
			content, _ := mm["content"].(string)
			if role == "" || content == "" {
				continue
			}
			p.Messages = append(p.Messages, message{Role: role, Content: content})
		}
	}

	if toolsRaw, ok := raw["tools"].([]any); ok {
		for _, t := range toolsRaw {
			tm, ok := t.(map[string]any)
			if !ok {
				continue
			}
			tc, err := parseToolConfig(tm)
			if err != nil {
				return nil, err
			}
			p.Tools = append(p.Tools, tc)
		}
	}

	if serversRaw, ok := raw["mcp_servers"].([]any); ok {
		for _, s := range serversRaw {
			sm, ok := s.(map[string]any)
			if !ok {
				continue
			}
			name, _ := sm["name"].(string)
			transport, _ := sm["transport"].(string)
			url, _ := sm["url"].(string)
			if url == "" {
				continue
			}
			creds, _ := sm["credentials"].(map[string]any)
			p.MCPServers = append(p.MCPServers, mcpServerConfig{
				Name:        name,
				Transport:   transport,
				URL:         url,
				Credentials: creds,
			})
		}
	}

	return p, nil
}

func parseToolConfig(m map[string]any) (toolConfig, error) {
	tc := toolConfig{}
	tc.Type, _ = m["type"].(string)
	tc.Name, _ = m["name"].(string)
	tc.Description, _ = m["description"].(string)
	tc.Credentials, _ = m["credentials"].(map[string]any)

	if tc.Type != "http_request" {
		return tc, fmt.Errorf("agent: unsupported tool type %q (only http_request is supported in v0)", tc.Type)
	}
	if tc.Name == "" {
		return tc, fmt.Errorf("agent: tool name is required")
	}

	cfg, ok := m["config"].(map[string]any)
	if !ok {
		return tc, fmt.Errorf("agent: tool %q is missing config", tc.Name)
	}
	tc.HTTP = parseHTTPToolConfig(cfg)
	return tc, nil
}

func parseHTTPToolConfig(cfg map[string]any) *httpToolConfig {
	h := &httpToolConfig{}
	h.Method, _ = cfg["method"].(string)
	if h.Method == "" {
		h.Method = "GET"
	}
	h.URL = parseFieldMode(cfg["url"])
	h.Headers = parseKVFields(cfg["headers"])
	h.Query = parseKVFields(cfg["query"])
	h.Body = parseKVFields(cfg["body"])
	h.Timeout, _ = cfg["timeout"].(string)
	h.Retry, _ = cfg["retry"].(string)
	h.RetryDelay, _ = cfg["retry_delay"].(string)
	h.RaiseOnStatus, _ = cfg["raise_on_status"].(string)
	h.IgnoreSSL, _ = cfg["ignore_ssl"].(bool)
	return h
}

// parseFieldMode accepts either {mode, value} / {mode, agent} or a bare
// scalar (treated as a fixed value).
func parseFieldMode(raw any) fieldMode {
	if raw == nil {
		return fieldMode{Mode: "fixed", Value: ""}
	}
	m, ok := raw.(map[string]any)
	if !ok {
		return fieldMode{Mode: "fixed", Value: raw}
	}
	mode, _ := m["mode"].(string)
	if mode == "agent" {
		af := &agentField{}
		if a, ok := m["agent"].(map[string]any); ok {
			af.Description, _ = a["description"].(string)
			af.Type, _ = a["type"].(string)
			af.Required, _ = a["required"].(bool)
		}
		if af.Type == "" {
			af.Type = "string"
		}
		return fieldMode{Mode: "agent", Agent: af}
	}
	return fieldMode{Mode: "fixed", Value: m["value"]}
}

func parseKVFields(raw any) []kvField {
	arr, ok := raw.([]any)
	if !ok {
		return nil
	}
	out := make([]kvField, 0, len(arr))
	for _, e := range arr {
		em, ok := e.(map[string]any)
		if !ok {
			continue
		}
		key, _ := em["key"].(string)
		if key == "" {
			continue
		}
		out = append(out, kvField{Key: key, Value: parseFieldMode(em["value"])})
	}
	return out
}

func asFloat32(v any) (float32, bool) {
	switch x := v.(type) {
	case float64:
		return float32(x), true
	case float32:
		return x, true
	case int:
		return float32(x), true
	case int64:
		return float32(x), true
	}
	return 0, false
}
