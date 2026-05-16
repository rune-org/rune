package sheets

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestDeleteRows(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotBatchUpdate bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v4/spreadsheets/sheet-1":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"sheets": []any{
					map[string]any{"properties": map[string]any{"sheetId": 7.0, "title": "Sheet1"}},
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

	out, err := DeleteRows{}.Execute(context.Background(), plugin.ExecutionContext{
		Type: DeleteRowsKind,
		Parameters: map[string]any{
			"spreadsheet_id": "sheet-1",
			"sheet_name":     "Sheet1",
			"start_row":      2,
			"row_count":      3,
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
