package dropbox

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestListFolder_Execute(t *testing.T) {
	var gotMethod, gotPath string
	var gotBody map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"entries": []}`))
	}))
	defer srv.Close()

	originalBaseURL := baseURL
	baseURL = srv.URL
	defer func() { baseURL = originalBaseURL }()

	tool := ListFolder{}
	ec := plugin.ExecutionContext{
		Parameters: map[string]any{
			"path":      "/Temporary",
			"recursive": true,
			"limit":     10,
		},
	}

	_, err := tool.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotMethod != "POST" {
		t.Errorf("expected POST, got %s", gotMethod)
	}
	if gotPath != "/2/files/list_folder" {
		t.Errorf("expected /2/files/list_folder, got %s", gotPath)
	}
	if gotBody["path"] != "/Temporary" {
		t.Errorf("expected path to be /Temporary, got %v", gotBody["path"])
	}
	if gotBody["recursive"] != true {
		t.Errorf("expected recursive to be true, got %v", gotBody["recursive"])
	}
	if gotBody["limit"] != float64(10) {
		t.Errorf("expected limit to be 10, got %v", gotBody["limit"])
	}
}
