package dropbox

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestGetTemporaryLink_Execute(t *testing.T) {
	var gotMethod, gotPath string
	var gotBody map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"link": "https://dl.dropboxusercontent.com/..."}`))
	}))
	defer srv.Close()

	originalBaseURL := baseURL
	baseURL = srv.URL
	defer func() { baseURL = originalBaseURL }()

	tool := GetTemporaryLink{}
	ec := plugin.ExecutionContext{
		Parameters: map[string]any{
			"path": "/Temporary/test.txt",
		},
	}

	_, err := tool.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotMethod != "POST" {
		t.Errorf("expected POST, got %s", gotMethod)
	}
	if gotPath != "/2/files/get_temporary_link" {
		t.Errorf("expected /2/files/get_temporary_link, got %s", gotPath)
	}
	if gotBody["path"] != "/Temporary/test.txt" {
		t.Errorf("expected path to be /Temporary/test.txt, got %v", gotBody["path"])
	}

	// Test missing path validation
	ec.Parameters = map[string]any{}
	_, err = tool.Execute(context.Background(), ec)
	if err == nil {
		t.Error("expected error for missing path, got nil")
	}
}
