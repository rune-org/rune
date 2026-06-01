package outlook

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestSendEmail_Execute(t *testing.T) {
	var gotMethod, gotPath string
	var gotBody map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		if r.Body != nil {
			b, _ := io.ReadAll(r.Body)
			_ = json.Unmarshal(b, &gotBody)
		}
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()

	originalBaseURL := baseURL
	baseURL = srv.URL
	defer func() { baseURL = originalBaseURL }()

	tool := SendEmail{}
	ec := plugin.ExecutionContext{
		Parameters: map[string]any{
			"to":      "test@example.com,test2@example.com",
			"cc":      "cc@example.com",
			"subject": "Hello",
			"body":    "World",
		},
	}

	_, err := tool.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotMethod != "POST" {
		t.Errorf("expected POST, got %s", gotMethod)
	}
	if gotPath != "/v1.0/me/sendMail" {
		t.Errorf("expected /v1.0/me/sendMail, got %s", gotPath)
	}

	msg, ok := gotBody["message"].(map[string]any)
	if !ok {
		t.Fatalf("expected message object in body")
	}

	if msg["subject"] != "Hello" {
		t.Errorf("expected subject Hello, got %v", msg["subject"])
	}

	bodyObj, ok := msg["body"].(map[string]any)
	if !ok || bodyObj["content"] != "World" {
		t.Errorf("expected body.content World, got %v", bodyObj)
	}

	toRecipients, ok := msg["toRecipients"].([]any)
	if !ok || len(toRecipients) != 2 {
		t.Errorf("expected 2 toRecipients, got %v", toRecipients)
	}

	ccRecipients, ok := msg["ccRecipients"].([]any)
	if !ok || len(ccRecipients) != 1 {
		t.Errorf("expected 1 ccRecipients, got %v", ccRecipients)
	}
}

func TestSendEmail_MissingArgs(t *testing.T) {
	tool := SendEmail{}

	tests := []struct {
		name string
		args map[string]any
	}{
		{"missing to", map[string]any{"subject": "S", "body": "B"}},
		{"missing subject", map[string]any{"to": "T", "body": "B"}},
		{"missing body", map[string]any{"to": "T", "subject": "S"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ec := plugin.ExecutionContext{Parameters: tt.args}
			_, err := tool.Execute(context.Background(), ec)
			if err == nil {
				t.Error("expected error, got nil")
			}
		})
	}
}
