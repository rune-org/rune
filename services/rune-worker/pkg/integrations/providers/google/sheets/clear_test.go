package sheets

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestClearSheetRange(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotPath string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewEncoder(w).Encode(map[string]any{"clearedRange": "Sheet1!A1:B2"})
	}))
	defer server.Close()
	baseURL = server.URL

	out, err := ClearSheet{}.Execute(context.Background(), plugin.ExecutionContext{
		Type: ClearSheetKind,
		Parameters: map[string]any{
			"spreadsheet_id": "sheet-1",
			"sheet_name":     "Sheet1",
			"range":          "A1:B2",
		},
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if gotPath != "/v4/spreadsheets/sheet-1/values/Sheet1!A1:B2:clear" {
		t.Fatalf("path = %q", gotPath)
	}
	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v", out["status"])
	}
}
