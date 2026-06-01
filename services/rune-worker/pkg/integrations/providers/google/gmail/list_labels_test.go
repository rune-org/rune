package gmail

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestListLabels(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotPath string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_ = json.NewEncoder(w).Encode(map[string]any{"labels": []any{}})
	}))
	defer server.Close()
	baseURL = server.URL

	out, err := ListLabels{}.Execute(context.Background(), plugin.ExecutionContext{Type: ListLabelsKind})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if gotPath != "/gmail/v1/users/me/labels" {
		t.Fatalf("path = %q", gotPath)
	}
	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v", out["status"])
	}
}
