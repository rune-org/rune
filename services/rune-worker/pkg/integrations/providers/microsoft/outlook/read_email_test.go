package outlook

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestReadEmail_Execute(t *testing.T) {
	var gotMethod, gotPath, gotQuery string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotQuery = r.URL.RawQuery
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"msg-1"}`))
	}))
	defer srv.Close()

	originalBaseURL := baseURL
	baseURL = srv.URL
	defer func() { baseURL = originalBaseURL }()

	tool := ReadEmail{}
	ec := plugin.ExecutionContext{
		Parameters: map[string]any{
			"id":     "msg-1",
			"select": "subject,body",
		},
	}

	_, err := tool.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotMethod != "GET" {
		t.Errorf("expected GET, got %s", gotMethod)
	}
	if gotPath != "/v1.0/me/messages/msg-1" {
		t.Errorf("expected /v1.0/me/messages/msg-1, got %s", gotPath)
	}
	if gotQuery != "%24select=subject%2Cbody" {
		t.Errorf("expected query $select=subject,body, got %s", gotQuery)
	}
}

func TestReadEmail_MissingID(t *testing.T) {
	tool := ReadEmail{}
	ec := plugin.ExecutionContext{Parameters: map[string]any{}}
	_, err := tool.Execute(context.Background(), ec)
	if err == nil {
		t.Error("expected error for missing id, got nil")
	}
}
