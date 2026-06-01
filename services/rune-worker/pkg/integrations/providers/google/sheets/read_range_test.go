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

func TestReadRange(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotPath string
	var gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		_ = json.NewEncoder(w).Encode(map[string]any{"values": []any{}})
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
	if gotPath != "/v4/spreadsheets/sheet-1/values/Sheet1!A1:B2" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotAuth != "Bearer tok-read" {
		t.Fatalf("auth = %q", gotAuth)
	}
	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v", out["status"])
	}
}

func TestReadRangeRequiresArgs(t *testing.T) {
	_, err := ReadRange{}.Execute(context.Background(), plugin.ExecutionContext{
		Type:       ReadRangeKind,
		Parameters: map[string]any{"spreadsheet_id": "sheet-1"},
	})
	if err == nil {
		t.Fatal("expected missing range error")
	}
}

func TestReadRangeNon2xx(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "forbidden"})
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
