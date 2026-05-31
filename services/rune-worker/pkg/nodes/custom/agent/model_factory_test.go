package agent

import (
	"context"
	"strings"
	"testing"
)

func TestBuildModel_RejectsUnsupportedProviders(t *testing.T) {
	for _, provider := range []string{"openai", "anthropic"} {
		t.Run(provider, func(t *testing.T) {
			_, err := buildModel(
				context.Background(),
				modelConfig{Provider: provider, Name: "x"},
				map[string]any{"values": map[string]any{"api_key": "k"}},
			)
			if err == nil {
				t.Fatalf("expected provider %q to be rejected", provider)
			}
			if !strings.Contains(err.Error(), "not yet supported") {
				t.Fatalf("expected 'not yet supported' in error, got %v", err)
			}
		})
	}
}

func TestBuildModel_RejectsUnknownProvider(t *testing.T) {
	_, err := buildModel(context.Background(), modelConfig{Provider: "bogus", Name: "x"}, nil)
	if err == nil || !strings.Contains(err.Error(), "unknown provider") {
		t.Fatalf("expected unknown-provider error, got %v", err)
	}
}

func TestBuildModel_GeminiRequiresApiKey(t *testing.T) {
	_, err := buildModel(context.Background(), modelConfig{Provider: "gemini", Name: "gemini-flash-latest"}, nil)
	if err == nil || !strings.Contains(err.Error(), "api_key") {
		t.Fatalf("expected api_key error, got %v", err)
	}
}

func TestBuildModel_GeminiRejectsUnknownBackend(t *testing.T) {
	_, err := buildModel(
		context.Background(),
		modelConfig{Provider: "gemini", Name: "gemini-flash-latest", Backend: "bogus"},
		map[string]any{"values": map[string]any{"api_key": "k"}},
	)
	if err == nil || !strings.Contains(err.Error(), "unknown gemini backend") {
		t.Fatalf("expected unknown-backend error, got %v", err)
	}
}

func TestPickAPIKey_FromValuesMap(t *testing.T) {
	cred := map[string]any{
		"type":   "api_key",
		"values": map[string]any{"api_key": "sk-test"},
	}
	if got := pickAPIKey(cred); got != "sk-test" {
		t.Errorf("expected sk-test, got %q", got)
	}
}

func TestPickAPIKey_FlatLegacyShape(t *testing.T) {
	cred := map[string]any{"api_key": "flat-key"}
	if got := pickAPIKey(cred); got != "flat-key" {
		t.Errorf("expected flat-key, got %q", got)
	}
}

func TestSplitMessages_RequiresLastUser(t *testing.T) {
	_, _, err := splitMessages([]message{{Role: "user", Content: "a"}, {Role: "model", Content: "b"}})
	if err == nil {
		t.Fatal("expected error when last message is not user")
	}
}

func TestSplitMessages_HappyPath(t *testing.T) {
	hist, last, err := splitMessages([]message{
		{Role: "user", Content: "first"},
		{Role: "model", Content: "reply"},
		{Role: "user", Content: "follow-up"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(hist) != 2 {
		t.Errorf("expected 2 history messages, got %d", len(hist))
	}
	if last == nil || last.Parts[0].Text != "follow-up" {
		t.Errorf("unexpected last content: %+v", last)
	}
}

func TestSplitMessages_RejectsEmpty(t *testing.T) {
	_, _, err := splitMessages(nil)
	if err == nil {
		t.Fatal("expected error for empty messages")
	}
}
