package gmail

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

func TestSendEmail(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	var gotMethod string
	var gotPath string
	var gotAuth string
	var gotRaw string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		gotRaw, _ = body["raw"].(string)
		_ = json.NewEncoder(w).Encode(map[string]any{"id": "sent-1"})
	}))
	defer server.Close()
	baseURL = server.URL

	ec := plugin.ExecutionContext{
		Type: SendEmailKind,
		Parameters: map[string]any{
			"to":      "team@example.com",
			"cc":      "cc1@example.com",
			"bcc":     "bcc1@example.com",
			"subject": "Hello",
			"body":    "Testing body",
		},
	}
	ec.SetCredentials(map[string]any{
		"type":         "oauth2",
		"access_token": "tok-send",
	})

	out, err := SendEmail{}.Execute(context.Background(), ec)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}

	if gotMethod != "POST" {
		t.Fatalf("method = %q", gotMethod)
	}
	if gotPath != "/gmail/v1/users/me/messages/send" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotAuth != "Bearer tok-send" {
		t.Fatalf("auth = %q", gotAuth)
	}
	if gotRaw == "" {
		t.Fatal("raw message should not be empty")
	}

	decoded, err := base64.RawURLEncoding.DecodeString(gotRaw)
	if err != nil {
		t.Fatalf("decode raw error = %v", err)
	}
	msg := string(decoded)
	if !strings.Contains(msg, "To: team@example.com") ||
		!strings.Contains(msg, "Cc: cc1@example.com") ||
		!strings.Contains(msg, "Bcc: bcc1@example.com") ||
		!strings.Contains(msg, "Subject: Hello") {
		t.Fatalf("unexpected mime message: %s", msg)
	}

	if status, _ := out["status"].(int); status != 200 {
		t.Fatalf("status = %v", out["status"])
	}
}

func TestSendEmailRequiredArgs(t *testing.T) {
	_, err := SendEmail{}.Execute(context.Background(), plugin.ExecutionContext{
		Type:       SendEmailKind,
		Parameters: map[string]any{"to": "team@example.com"},
	})
	if err == nil {
		t.Fatal("expected missing subject/body error")
	}
}

func TestSendEmailNon2xx(t *testing.T) {
	origBaseURL := baseURL
	defer func() { baseURL = origBaseURL }()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "bad_token"})
	}))
	defer server.Close()
	baseURL = server.URL

	_, err := SendEmail{}.Execute(context.Background(), plugin.ExecutionContext{
		Type: SendEmailKind,
		Parameters: map[string]any{
			"to":      "team@example.com",
			"subject": "Hello",
			"body":    "Body",
		},
	})
	if err == nil {
		t.Fatal("expected connector error")
	}
	if _, ok := err.(*connector.Error); !ok {
		t.Fatalf("expected *connector.Error, got %T", err)
	}
}
