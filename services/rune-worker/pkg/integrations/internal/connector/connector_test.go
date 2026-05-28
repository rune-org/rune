package connector

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"rune-worker/plugin"
)

func TestBuildURL(t *testing.T) {
	got, err := buildURL("https://example.com", "/v1/items/{id}", map[string]string{"id": "a/b"})
	if err != nil {
		t.Fatalf("buildURL() error = %v", err)
	}
	want := "https://example.com/v1/items/a%2Fb"
	if got != want {
		t.Fatalf("buildURL() = %q, want %q", got, want)
	}
}

func TestDoInjectsAuthAndQuery(t *testing.T) {
	var auth string
	var rawQuery string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth = r.Header.Get("Authorization")
		rawQuery = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer server.Close()

	ec := plugin.ExecutionContext{}
	ec.SetCredentials(map[string]any{
		"type":         "oauth2",
		"access_token": "tok-123",
	})

	out, err := Do(context.Background(), ec, Spec{
		Method:  "GET",
		BaseURL: server.URL,
		Path:    "/v1/test",
		Query: map[string]string{
			"q": "foo",
		},
	})
	if err != nil {
		t.Fatalf("Do() error = %v", err)
	}
	if auth != "Bearer tok-123" {
		t.Fatalf("Authorization = %q, want Bearer tok-123", auth)
	}
	if !strings.Contains(rawQuery, "q=foo") {
		t.Fatalf("query = %q, expected q=foo", rawQuery)
	}
	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v, want 200", out["status"])
	}
}

func TestDoNon2xxReturnsConnectorError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "bad_request"})
	}))
	defer server.Close()

	_, err := Do(context.Background(), plugin.ExecutionContext{}, Spec{
		Method:  "GET",
		BaseURL: server.URL,
		Path:    "/v1/test",
	})
	if err == nil {
		t.Fatal("expected non-2xx error")
	}
	connErr, ok := err.(*Error)
	if !ok {
		t.Fatalf("expected *Error, got %T", err)
	}
	if connErr.Status != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", connErr.Status, http.StatusBadRequest)
	}
}

func TestDoAllowNon2xx(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "missing"})
	}))
	defer server.Close()

	out, err := Do(context.Background(), plugin.ExecutionContext{}, Spec{
		Method:      "GET",
		BaseURL:     server.URL,
		Path:        "/v1/test",
		AllowNon2xx: true,
	})
	if err != nil {
		t.Fatalf("Do() error = %v", err)
	}
	if status, _ := out["status"].(int); status != http.StatusNotFound {
		t.Fatalf("status = %v, want %d", out["status"], http.StatusNotFound)
	}
}
