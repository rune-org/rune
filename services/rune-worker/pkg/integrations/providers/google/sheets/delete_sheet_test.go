package sheets

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestDeleteSheet(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotBatchUpdate bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v4/spreadsheets/sheet-1":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"sheets": []any{
					map[string]any{"properties": map[string]any{"sheetId": 12.0, "title": "Sheet1"}},
				},
			})
		case "/v4/spreadsheets/sheet-1:batchUpdate":
			gotBatchUpdate = true
			_ = json.NewEncoder(w).Encode(map[string]any{"replies": []any{}})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()
	baseURL = server.URL

	out, err := DeleteSheet{}.Execute(context.Background(), plugin.ExecutionContext{
		Type: DeleteSheetKind,
		Parameters: map[string]any{
			"spreadsheet_id": "sheet-1",
			"sheet_name":     "Sheet1",
		},
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if !gotBatchUpdate {
		t.Fatal("expected batchUpdate call")
	}
	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v", out["status"])
	}
}
