package sheets

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestAppendRow(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotPath string
	var gotMethod string
	var gotQuery string
	var gotBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotMethod = r.Method
		gotQuery = r.URL.Query().Get("valueInputOption")
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(map[string]any{"updates": map[string]any{}})
	}))
	defer server.Close()
	baseURL = server.URL

	out, err := AppendRow{}.Execute(context.Background(), plugin.ExecutionContext{
		Type: AppendRowKind,
		Parameters: map[string]any{
			"spreadsheet_id":     "sheet-1",
			"sheet_name":         "Sheet1",
			"value_input_option": "RAW",
			"values":             []any{[]any{"A", "B", "C", "D"}},
		},
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if gotMethod != "POST" {
		t.Fatalf("method = %q", gotMethod)
	}
	if gotPath != "/v4/spreadsheets/sheet-1/values/Sheet1:append" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotQuery != "RAW" {
		t.Fatalf("valueInputOption = %q", gotQuery)
	}
	values, _ := gotBody["values"].([]any)
	if len(values) != 1 {
		t.Fatalf("values length = %d", len(values))
	}
	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v", out["status"])
	}
}

func TestAppendRowRequiresArgs(t *testing.T) {
	_, err := AppendRow{}.Execute(context.Background(), plugin.ExecutionContext{
		Type:       AppendRowKind,
		Parameters: map[string]any{"spreadsheet_id": "sheet-1"},
	})
	if err == nil {
		t.Fatal("expected missing sheet_name/values error")
	}
}
