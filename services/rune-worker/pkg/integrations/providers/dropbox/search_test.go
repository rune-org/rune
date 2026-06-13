package dropbox

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestSearch_Execute(t *testing.T) {
	var gotMethod, gotPath string
	var gotBody map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"matches": []}`))
	}))
	defer srv.Close()

	originalBaseURL := baseURL
	baseURL = srv.URL
	defer func() { baseURL = originalBaseURL }()

	tool := Search{}
	ec := plugin.ExecutionContext{
		Parameters: map[string]any{
			"query":         "invoice",
			"path":          "/Invoices",
			"filename_only": true,
		},
	}

	_, err := tool.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotMethod != "POST" {
		t.Errorf("expected POST, got %s", gotMethod)
	}
	if gotPath != "/2/files/search_v2" {
		t.Errorf("expected /2/files/search_v2, got %s", gotPath)
	}
	if gotBody["query"] != "invoice" {
		t.Errorf("expected query to be invoice, got %v", gotBody["query"])
	}

	options, ok := gotBody["options"].(map[string]any)
	if !ok {
		t.Fatalf("expected options object in request body, got %v", gotBody["options"])
	}
	if options["path"] != "/Invoices" {
		t.Errorf("expected options.path to be /Invoices, got %v", options["path"])
	}
	if options["filename_only"] != true {
		t.Errorf("expected options.filename_only to be true, got %v", options["filename_only"])
	}

	// Test missing query validation
	ec.Parameters = map[string]any{}
	_, err = tool.Execute(context.Background(), ec)
	if err == nil {
		t.Error("expected error for missing query, got nil")
	}
}
