package slack

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestPostMessage(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotMethod string
	var gotPath string
	var gotChannel string
	var gotText string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		gotChannel, _ = body["channel"].(string)
		gotText, _ = body["text"].(string)
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "ts": "123.456"})
	}))
	defer server.Close()
	baseURL = server.URL

	ec := plugin.ExecutionContext{
		Type: PostMessageKind,
		Parameters: map[string]any{
			"channel": "C123456",
			"text":    "Hello world",
		},
	}
	ec.SetCredentials(map[string]any{
		"type":         "token",
		"access_token": "xoxb-test",
	})

	out, err := PostMessage{}.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}

	if gotMethod != "POST" {
		t.Fatalf("method = %q", gotMethod)
	}
	if gotPath != "/api/chat.postMessage" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotChannel != "C123456" {
		t.Fatalf("channel = %q", gotChannel)
	}
	if gotText != "Hello world" {
		t.Fatalf("text = %q", gotText)
	}

	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v", out["status"])
	}
}

func TestPostMessageRequiredArgs(t *testing.T) {
	_, err := PostMessage{}.Execute(context.Background(), plugin.ExecutionContext{
		Type:       PostMessageKind,
		Parameters: map[string]any{"channel": "C123"},
	})
	if err == nil {
		t.Fatal("expected missing text error")
	}
}
