package agent

import (
	"context"
	"fmt"

	"google.golang.org/adk/model"
	"google.golang.org/adk/model/gemini"
	"google.golang.org/genai"
)

// buildModel returns an ADK model.LLM for the chosen provider.
// v0: only Gemini is wired; OpenAI/Anthropic return an explicit error.
func buildModel(ctx context.Context, cfg modelConfig, creds map[string]any) (model.LLM, error) {
	switch cfg.Provider {
	case "gemini":
		apiKey := pickAPIKey(creds)
		if apiKey == "" {
			return nil, fmt.Errorf("agent: gemini provider requires an api_key credential")
		}
		clientCfg := &genai.ClientConfig{APIKey: apiKey}
		switch cfg.Backend {
		case "", "ai_studio":
			clientCfg.Backend = genai.BackendGeminiAPI
		case "vertex":
			clientCfg.Backend = genai.BackendVertexAI
		default:
			return nil, fmt.Errorf("agent: unknown gemini backend %q (expected \"ai_studio\" or \"vertex\")", cfg.Backend)
		}
		return gemini.NewModel(ctx, cfg.Name, clientCfg)

	case "openai", "anthropic":
		return nil, fmt.Errorf("agent: provider %q not yet supported (schema-ready, implementation pending)", cfg.Provider)

	default:
		return nil, fmt.Errorf("agent: unknown provider %q", cfg.Provider)
	}
}

// buildGenerationConfig returns nil when no per-call knobs are set, which
// tells ADK to use the model's defaults.
func buildGenerationConfig(cfg modelConfig) *genai.GenerateContentConfig {
	if cfg.Temperature == nil {
		return nil
	}
	return &genai.GenerateContentConfig{Temperature: cfg.Temperature}
}

// pickAPIKey reads the API key from a master-resolved credential.
// Resolved shape: {"type", "values": {...}}; *_api_key types use "api_key".
func pickAPIKey(creds map[string]any) string {
	if creds == nil {
		return ""
	}
	values, ok := creds["values"].(map[string]any)
	if !ok {
		values = creds
	}
	if k, ok := values["api_key"].(string); ok && k != "" {
		return k
	}
	if k, ok := values["key"].(string); ok && k != "" {
		return k
	}
	return ""
}
