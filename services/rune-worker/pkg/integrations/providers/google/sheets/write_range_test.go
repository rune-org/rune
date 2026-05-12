package sheets

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

func TestWriteRange(t *testing.T) {
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
		_ = json.NewEncoder(w).Encode(map[string]any{"updatedCells": 2})
	}))
	defer server.Close()
	baseURL = server.URL

	out, err := WriteRange{}.Execute(context.Background(), plugin.ExecutionContext{
		Type: WriteRangeKind,
		Parameters: map[string]any{
			"spreadsheet_id":     "sheet-1",
			"range":              "Sheet1!A1:B2",
			"value_input_option": "USER_ENTERED",
			"values":             []any{[]any{"Name", "Status"}, []any{"Alex", "Done"}},
		},
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if gotMethod != "PUT" {
		t.Fatalf("method = %q", gotMethod)
	}
	if gotPath != "/v4/spreadsheets/sheet-1/values/Sheet1!A1:B2" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotQuery != "USER_ENTERED" {
		t.Fatalf("valueInputOption = %q", gotQuery)
	}
	if gotBody["range"].(string) != "Sheet1!A1:B2" {
		t.Fatalf("range body = %v", gotBody["range"])
	}
	values, _ := gotBody["values"].([]any)
	if len(values) != 2 {
		t.Fatalf("values length = %d", len(values))
	}
	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v", out["status"])
	}
}

func TestWriteRangeRequiresValues(t *testing.T) {
	_, err := WriteRange{}.Execute(context.Background(), plugin.ExecutionContext{
		Type: WriteRangeKind,
		Parameters: map[string]any{
			"spreadsheet_id": "sheet-1",
			"range":          "Sheet1!A1:B2",
		},
	})
	if err == nil {
		t.Fatal("expected missing values error")
	}
}

func TestWriteRangeNon2xx(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "unauthorized"})
	}))
	defer server.Close()
	baseURL = server.URL

	_, err := WriteRange{}.Execute(context.Background(), plugin.ExecutionContext{
		Type: WriteRangeKind,
		Parameters: map[string]any{
			"spreadsheet_id": "sheet-1",
			"range":          "Sheet1!A1:B2",
			"values":         []any{[]any{"Name"}},
		},
	})
	if err == nil {
		t.Fatal("expected connector error")
	}
	if _, ok := err.(*connector.Error); !ok {
		t.Fatalf("expected *connector.Error, got %T", err)
	}
}
