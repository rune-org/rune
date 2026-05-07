package gmail

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

func TestReadEmail(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotPath string
	var gotFormat string
	var gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotFormat = r.URL.Query().Get("format")
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"id": "msg-1"})
	}))
	defer server.Close()
	baseURL = server.URL

	ec := plugin.ExecutionContext{
		Type:       ReadEmailKind,
		Parameters: map[string]any{"id": "msg-1", "format": "metadata"},
	}
	ec.SetCredentials(map[string]any{
		"type":         "oauth2",
		"access_token": "tok-read",
	})

	out, err := ReadEmail{}.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if gotPath != "/gmail/v1/users/me/messages/msg-1" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotFormat != "metadata" {
		t.Fatalf("format = %q", gotFormat)
	}
	if gotAuth != "Bearer tok-read" {
		t.Fatalf("auth = %q", gotAuth)
	}
	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v", out["status"])
	}
}

func TestReadEmailRequiresID(t *testing.T) {
	_, err := ReadEmail{}.Execute(context.Background(), plugin.ExecutionContext{
		Type:       ReadEmailKind,
		Parameters: map[string]any{},
	})
	if err == nil {
		t.Fatal("expected missing id error")
	}
}

func TestReadEmailNon2xx(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "unauthorized"})
	}))
	defer server.Close()
	baseURL = server.URL

	_, err := ReadEmail{}.Execute(context.Background(), plugin.ExecutionContext{
		Type:       ReadEmailKind,
		Parameters: map[string]any{"id": "msg-1"},
	})
	if err == nil {
		t.Fatal("expected connector error")
	}
	if _, ok := err.(*connector.Error); !ok {
		t.Fatalf("expected *connector.Error, got %T", err)
	}
}
