package sheets

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestCreateSheet(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotPath string
	var gotBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(map[string]any{"replies": []any{}})
	}))
	defer server.Close()
	baseURL = server.URL

	out, err := CreateSheet{}.Execute(context.Background(), plugin.ExecutionContext{
		Type: CreateSheetKind,
		Parameters: map[string]any{
			"spreadsheet_id": "sheet-1",
			"title":          "New Sheet",
			"rows":           10,
			"columns":        5,
		},
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if gotPath != "/v4/spreadsheets/sheet-1:batchUpdate" {
		t.Fatalf("path = %q", gotPath)
	}
	requests, _ := gotBody["requests"].([]any)
	if len(requests) != 1 {
		t.Fatalf("requests length = %d", len(requests))
	}
	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v", out["status"])
	}
}
