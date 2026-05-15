package sheets

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestCreateSpreadsheet(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotPath string
	var gotMethod string
	var gotBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotMethod = r.Method
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(map[string]any{"spreadsheetId": "sheet-1"})
	}))
	defer server.Close()
	baseURL = server.URL

	out, err := CreateSpreadsheet{}.Execute(context.Background(), plugin.ExecutionContext{
		Type:       CreateSpreadsheetKind,
		Parameters: map[string]any{"title": "New Sheet"},
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if gotMethod != "POST" {
		t.Fatalf("method = %q", gotMethod)
	}
	if gotPath != "/v4/spreadsheets" {
		t.Fatalf("path = %q", gotPath)
	}
	properties, _ := gotBody["properties"].(map[string]any)
	if properties["title"] != "New Sheet" {
		t.Fatalf("title = %v", properties["title"])
	}
	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v", out["status"])
	}
}

func TestCreateSpreadsheetRequiresTitle(t *testing.T) {
	_, err := CreateSpreadsheet{}.Execute(context.Background(), plugin.ExecutionContext{
		Type:       CreateSpreadsheetKind,
		Parameters: map[string]any{},
	})
	if err == nil {
		t.Fatal("expected missing title error")
	}
}
