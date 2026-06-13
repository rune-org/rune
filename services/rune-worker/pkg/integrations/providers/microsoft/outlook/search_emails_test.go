package outlook

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestSearchEmails_Execute(t *testing.T) {
	var gotMethod, gotPath, gotQuery string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotQuery = r.URL.RawQuery
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"value":[]}`))
	}))
	defer srv.Close()

	originalBaseURL := baseURL
	baseURL = srv.URL
	defer func() { baseURL = originalBaseURL }()

	tool := SearchEmails{}
	ec := plugin.ExecutionContext{
		Parameters: map[string]any{
			"q":          "test search",
			"maxResults": 10,
		},
	}

	_, err := tool.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotMethod != "GET" {
		t.Errorf("expected GET, got %s", gotMethod)
	}
	if gotPath != "/v1.0/me/messages" {
		t.Errorf("expected /v1.0/me/messages, got %s", gotPath)
	}
	if gotQuery != "%24search=%22test+search%22&%24top=10" && gotQuery != "%24top=10&%24search=%22test+search%22" {
		t.Errorf("unexpected query: %s", gotQuery)
	}
}

func TestSearchEmails_MissingQuery(t *testing.T) {
	tool := SearchEmails{}
	ec := plugin.ExecutionContext{Parameters: map[string]any{}}
	_, err := tool.Execute(context.Background(), ec)
	if err == nil {
		t.Error("expected error for missing query, got nil")
	}
}
