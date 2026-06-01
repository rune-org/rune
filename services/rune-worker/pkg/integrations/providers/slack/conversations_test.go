package slack

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestConversationsHistory(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotMethod string
	var gotPath string
	var gotChannel string
	var gotLimit string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotChannel = r.URL.Query().Get("channel")
		gotLimit = r.URL.Query().Get("limit")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "messages": []any{}})
	}))
	defer server.Close()
	baseURL = server.URL

	ec := plugin.ExecutionContext{
		Type: ConversationsHistoryKind,
		Parameters: map[string]any{
			"channel": "C123456",
			"limit":   20,
		},
	}
	ec.SetCredentials(map[string]any{
		"type":         "token",
		"access_token": "xoxb-test",
	})

	out, err := ConversationsHistory{}.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}

	if gotMethod != "GET" {
		t.Fatalf("method = %q", gotMethod)
	}
	if gotPath != "/api/conversations.history" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotChannel != "C123456" {
		t.Fatalf("channel = %q", gotChannel)
	}
	if gotLimit != "20" {
		t.Fatalf("limit = %q", gotLimit)
	}

	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v", out["status"])
	}
}

func TestFindMessage(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok": true,
			"messages": []any{
				map[string]any{"ts": "1234.0001", "text": "hello world"},
				map[string]any{"ts": "1234.0002", "text": "critical error 500 occurred"},
				map[string]any{"ts": "1234.0003", "text": "goodbye"},
			},
		})
	}))
	defer server.Close()
	baseURL = server.URL

	ec := plugin.ExecutionContext{
		Type: FindMessageKind,
		Parameters: map[string]any{
			"channel": "C123",
			"keyword": "error 500",
		},
	}
	ec.SetCredentials(map[string]any{"type": "token", "access_token": "xoxb"})

	out, err := FindMessage{}.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}

	if found, _ := out["found"].(bool); !found {
		t.Fatal("expected found = true")
	}
	msg, ok := out["message"].(map[string]any)
	if !ok {
		t.Fatal("expected message object")
	}
	if ts, _ := msg["ts"].(string); ts != "1234.0002" {
		t.Fatalf("expected ts = 1234.0002, got %v", ts)
	}
}

func TestFindMessageNotFound(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok": true,
			"messages": []any{
				map[string]any{"ts": "1234.0001", "text": "hello world"},
			},
		})
	}))
	defer server.Close()
	baseURL = server.URL

	ec := plugin.ExecutionContext{
		Type: FindMessageKind,
		Parameters: map[string]any{
			"channel": "C123",
			"keyword": "not found keyword",
		},
	}
	ec.SetCredentials(map[string]any{"type": "token", "access_token": "xoxb"})

	out, err := FindMessage{}.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}

	if found, _ := out["found"].(bool); found {
		t.Fatal("expected found = false")
	}
}

func TestConversationsHistoryRequiredArgs(t *testing.T) {
	_, err := ConversationsHistory{}.Execute(context.Background(), plugin.ExecutionContext{
		Type:       ConversationsHistoryKind,
		Parameters: map[string]any{},
	})
	if err == nil {
		t.Fatal("expected missing channel error")
	}
}
