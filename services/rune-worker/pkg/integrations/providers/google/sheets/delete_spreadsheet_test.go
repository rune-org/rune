package sheets

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestDeleteSpreadsheet(t *testing.T) {
	origBaseURL := driveBaseURL
	defer func() { driveBaseURL = origBaseURL }()

	var gotPath string
	var gotMethod string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotMethod = r.Method
		_ = json.NewEncoder(w).Encode(map[string]any{})
	}))
	defer server.Close()
	driveBaseURL = server.URL

	out, err := DeleteSpreadsheet{}.Execute(context.Background(), plugin.ExecutionContext{
		Type:       DeleteSpreadsheetKind,
		Parameters: map[string]any{"spreadsheet_id": "sheet-1"},
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if gotMethod != "DELETE" {
		t.Fatalf("method = %q", gotMethod)
	}
	if gotPath != "/drive/v3/files/sheet-1" {
		t.Fatalf("path = %q", gotPath)
	}
	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v", out["status"])
	}
}
