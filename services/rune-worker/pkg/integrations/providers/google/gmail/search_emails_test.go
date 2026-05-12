package gmail

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rune-worker/plugin"
)

func TestSearchEmails(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var query map[string]string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query = map[string]string{
			"q":                r.URL.Query().Get("q"),
			"maxResults":       r.URL.Query().Get("maxResults"),
			"labelIds":         r.URL.Query().Get("labelIds"),
			"includeSpamTrash": r.URL.Query().Get("includeSpamTrash"),
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"messages": []any{}})
	}))
	defer server.Close()
	baseURL = server.URL

	out, err := SearchEmails{}.Execute(context.Background(), plugin.ExecutionContext{
		Type: SearchEmailsKind,
		Parameters: map[string]any{
			"q":                "is:unread",
			"maxResults":       3,
			"labelIds":         "INBOX,UNREAD",
			"includeSpamTrash": true,
		},
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}

	if query["q"] != "is:unread" {
		t.Fatalf("q = %q", query["q"])
	}
	if query["maxResults"] != "3" {
		t.Fatalf("maxResults = %q", query["maxResults"])
	}
	if query["labelIds"] != "INBOX,UNREAD" {
		t.Fatalf("labelIds = %q", query["labelIds"])
	}
	if query["includeSpamTrash"] != "true" {
		t.Fatalf("includeSpamTrash = %q", query["includeSpamTrash"])
	}
	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v", out["status"])
	}
}

func TestSearchEmailsRequiresQ(t *testing.T) {
	_, err := SearchEmails{}.Execute(context.Background(), plugin.ExecutionContext{
		Type:       SearchEmailsKind,
		Parameters: map[string]any{},
	})
	if err == nil {
		t.Fatal("expected missing q error")
	}
}
