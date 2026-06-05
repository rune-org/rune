package telegram

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestSendMessage(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotPath string
	var gotBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer server.Close()
	baseURL = server.URL

	ec := plugin.ExecutionContext{
		Type: SendMessageKind,
		Parameters: map[string]any{
			"chat_id": "123",
			"text":    "Hello",
		},
	}
	ec.SetCredentials(map[string]any{
		"type":  "token",
		"token": "test-token",
	})

	_, err := SendMessage{}.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}

	if gotPath != "/bottest-token/sendMessage" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotBody["chat_id"] != "123" {
		t.Fatalf("chat_id = %v", gotBody["chat_id"])
	}
	if gotBody["text"] != "Hello" {
		t.Fatalf("text = %v", gotBody["text"])
	}
}

func TestSendPhoto(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotPath string
	var gotBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer server.Close()
	baseURL = server.URL

	ec := plugin.ExecutionContext{
		Type: SendPhotoKind,
		Parameters: map[string]any{
			"chat_id":    "123",
			"photo":      "https://example.com/p.jpg",
			"caption":    "Hi",
			"parse_mode": "HTML",
		},
	}
	ec.SetCredentials(map[string]any{
		"type":  "token",
		"token": "test-token",
	})

	_, err := SendPhoto{}.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}

	if gotPath != "/bottest-token/sendPhoto" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotBody["photo"] != "https://example.com/p.jpg" {
		t.Fatalf("photo = %v", gotBody["photo"])
	}
	if gotBody["caption"] != "Hi" {
		t.Fatalf("caption = %v", gotBody["caption"])
	}
	if gotBody["parse_mode"] != "HTML" {
		t.Fatalf("parse_mode = %v", gotBody["parse_mode"])
	}
}

func TestSendDocument(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotPath string
	var gotBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer server.Close()
	baseURL = server.URL

	ec := plugin.ExecutionContext{
		Type: SendDocumentKind,
		Parameters: map[string]any{
			"chat_id":  "123",
			"document": "https://example.com/file.pdf",
			"caption":  "Doc",
		},
	}
	ec.SetCredentials(map[string]any{
		"type":  "token",
		"token": "test-token",
	})

	_, err := SendDocument{}.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}

	if gotPath != "/bottest-token/sendDocument" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotBody["document"] != "https://example.com/file.pdf" {
		t.Fatalf("document = %v", gotBody["document"])
	}
}

func TestGetUpdates(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotPath string
	var gotBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer server.Close()
	baseURL = server.URL

	ec := plugin.ExecutionContext{
		Type: GetUpdatesKind,
		Parameters: map[string]any{
			"offset":          5,
			"limit":           10,
			"timeout":         15,
			"allowed_updates": "message,edited_message",
		},
	}
	ec.SetCredentials(map[string]any{
		"type":  "token",
		"token": "test-token",
	})

	_, err := GetUpdates{}.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}

	if gotPath != "/bottest-token/getUpdates" {
		t.Fatalf("path = %q", gotPath)
	}
	updates, _ := gotBody["allowed_updates"].([]any)
	if len(updates) != 2 {
		t.Fatalf("allowed_updates = %v", gotBody["allowed_updates"])
	}
}

func TestGetChatID(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotPath string
	var gotBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok": true,
			"result": []any{
				map[string]any{
					"update_id": 1,
					"message": map[string]any{
						"message_id": 1,
						"from": map[string]any{
							"id":         987654321,
							"first_name": "Test",
						},
						"chat": map[string]any{
							"id":         123456789,
							"type":       "private",
							"first_name": "Test",
							"last_name":  "User",
						},
						"text": "hi",
					},
				},
			},
		})
	}))
	defer server.Close()
	baseURL = server.URL

	ec := plugin.ExecutionContext{
		Type: GetChatIDKind,
	}
	ec.SetCredentials(map[string]any{
		"type":  "token",
		"token": "test-token",
	})

	result, err := GetChatID{}.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}

	if gotPath != "/bottest-token/getUpdates" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotBody["limit"] != float64(1) {
		t.Fatalf("limit = %v, expected 1", gotBody["limit"])
	}
	if result["chat_id"] != int64(123456789) {
		t.Fatalf("chat_id = %v, expected 123456789", result["chat_id"])
	}
	if result["chat_type"] != "private" {
		t.Fatalf("chat_type = %v", result["chat_type"])
	}
	if result["chat_name"] != "Test User" {
		t.Fatalf("chat_name = %v", result["chat_name"])
	}
}

func TestGetChatIDInvalidToken(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":          false,
			"error_code":  401,
			"description": "Unauthorized",
		})
	}))
	defer server.Close()
	baseURL = server.URL

	ec := plugin.ExecutionContext{
		Type: GetChatIDKind,
	}
	ec.SetCredentials(map[string]any{
		"type":  "token",
		"token": "bad-token",
	})

	_, err := GetChatID{}.Execute(context.Background(), ec)
	if err == nil {
		t.Fatal("expected error for invalid token")
	}
	if err.Error() != "telegram API error (401): Unauthorized" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestGetChatIDNoUpdates(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var callCount int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		if callCount == 1 {
			// getUpdates returns empty result
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":     true,
				"result": []any{},
			})
		} else {
			// getMe returns bot info
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok": true,
				"result": map[string]any{
					"id":         12345,
					"is_bot":     true,
					"first_name": "TestBot",
					"username":   "my_test_bot",
				},
			})
		}
	}))
	defer server.Close()
	baseURL = server.URL

	ec := plugin.ExecutionContext{
		Type: GetChatIDKind,
	}
	ec.SetCredentials(map[string]any{
		"type":  "token",
		"token": "test-token",
	})

	_, err := GetChatID{}.Execute(context.Background(), ec)
	if err == nil {
		t.Fatal("expected error for no updates")
	}
	if err.Error() != "no messages yet. Open Telegram, search for @my_test_bot, and send any message. Then run this node again" {
		t.Fatalf("unexpected error: %v", err)
	}
	if callCount != 2 {
		t.Fatalf("expected 2 API calls (getUpdates + getMe), got %d", callCount)
	}
}

func TestSendMessageRequiredArgs(t *testing.T) {
	_, err := SendMessage{}.Execute(context.Background(), plugin.ExecutionContext{
		Type:       SendMessageKind,
		Parameters: map[string]any{"chat_id": "123"},
	})
	if err == nil {
		t.Fatal("expected missing text error")
	}
}
