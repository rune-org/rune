package slack

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestLookupByEmail(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotMethod string
	var gotPath string
	var gotEmail string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotEmail = r.URL.Query().Get("email")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "user": map[string]any{"id": "U123456"}})
	}))
	defer server.Close()
	baseURL = server.URL

	ec := plugin.ExecutionContext{
		Type: LookupByEmailKind,
		Parameters: map[string]any{
			"email": "jane@example.com",
		},
	}
	ec.SetCredentials(map[string]any{
		"type":         "token",
		"access_token": "xoxb-test",
	})

	out, err := LookupByEmail{}.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}

	if gotMethod != "GET" {
		t.Fatalf("method = %q", gotMethod)
	}
	if gotPath != "/api/users.lookupByEmail" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotEmail != "jane@example.com" {
		t.Fatalf("email = %q", gotEmail)
	}

	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v", out["status"])
	}
}

func TestLookupByEmailRequiredArgs(t *testing.T) {
	_, err := LookupByEmail{}.Execute(context.Background(), plugin.ExecutionContext{
		Type:       LookupByEmailKind,
		Parameters: map[string]any{},
	})
	if err == nil {
		t.Fatal("expected missing email error")
	}
}
