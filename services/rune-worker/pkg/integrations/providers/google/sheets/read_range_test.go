package sheets

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

func TestReadRange(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotMethod string
	var gotPath string
	var gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"range":          "Sheet1!A1:B2",
			"majorDimension": "ROWS",
			"values":         [][]any{{1, 2}, {3, 4}},
		})
	}))
	defer server.Close()
	baseURL = server.URL

	ec := plugin.ExecutionContext{
		Type: ReadRangeKind,
		Parameters: map[string]any{
			"spreadsheet_id": "sheet-1",
			"range":          "Sheet1!A1:B2",
		},
	}
	ec.SetCredentials(map[string]any{
		"type":         "oauth2",
		"access_token": "tok-read",
	})

	out, err := ReadRange{}.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if gotMethod != "GET" {
		t.Fatalf("method = %q", gotMethod)
	}
	if gotPath != "/v4/spreadsheets/sheet-1/values/Sheet1!A1:B2" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotAuth != "Bearer tok-read" {
		t.Fatalf("auth = %q", gotAuth)
	}
	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v", out["status"])
	}
	body, ok := out["body"].(map[string]any)
	if !ok {
		t.Fatalf("body type = %T", out["body"])
	}
	if body["range"] != "Sheet1!A1:B2" {
		t.Fatalf("body.range = %v", body["range"])
	}
	if _, ok := body["values"].([]any); !ok {
		t.Fatalf("body.values type = %T", body["values"])
	}
}

func TestReadRangeRequiresSpreadsheetID(t *testing.T) {
	_, err := ReadRange{}.Execute(context.Background(), plugin.ExecutionContext{
		Type:       ReadRangeKind,
		Parameters: map[string]any{"range": "Sheet1!A1:B2"},
	})
	if err == nil {
		t.Fatal("expected missing spreadsheet_id error")
	}
	if !strings.Contains(err.Error(), "spreadsheet_id") {
		t.Fatalf("error = %v", err)
	}
}

func TestReadRangeRequiresRange(t *testing.T) {
	_, err := ReadRange{}.Execute(context.Background(), plugin.ExecutionContext{
		Type:       ReadRangeKind,
		Parameters: map[string]any{"spreadsheet_id": "sheet-1"},
	})
	if err == nil {
		t.Fatal("expected missing range error")
	}
	if !strings.Contains(err.Error(), "range") {
		t.Fatalf("error = %v", err)
	}
}

func TestReadRangeNon2xx(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "unauthorized"})
	}))
	defer server.Close()
	baseURL = server.URL

	_, err := ReadRange{}.Execute(context.Background(), plugin.ExecutionContext{
		Type: ReadRangeKind,
		Parameters: map[string]any{
			"spreadsheet_id": "sheet-1",
			"range":          "Sheet1!A1:B2",
		},
	})
	if err == nil {
		t.Fatal("expected connector error")
	}
	if _, ok := err.(*connector.Error); !ok {
		t.Fatalf("expected *connector.Error, got %T", err)
	}
}
