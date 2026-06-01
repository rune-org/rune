package outlook

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestListFolders_Execute(t *testing.T) {
	var gotMethod, gotPath string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"value":[]}`))
	}))
	defer srv.Close()

	originalBaseURL := baseURL
	baseURL = srv.URL
	defer func() { baseURL = originalBaseURL }()

	tool := ListFolders{}
	ec := plugin.ExecutionContext{}

	_, err := tool.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotMethod != "GET" {
		t.Errorf("expected GET, got %s", gotMethod)
	}
	if gotPath != "/v1.0/me/mailFolders" {
		t.Errorf("expected /v1.0/me/mailFolders, got %s", gotPath)
	}
}
