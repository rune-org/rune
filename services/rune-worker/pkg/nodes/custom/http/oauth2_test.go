package http

import (
	"context"
	"encoding/base64"
	nethttp "net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestFetchClientCredentialsToken_BasicAuthMethod(t *testing.T) {
	var gotAuth, gotCT, gotGrant, gotScope, gotClientID string

	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotCT = r.Header.Get("Content-Type")
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}
		gotGrant = r.Form.Get("grant_type")
		gotScope = r.Form.Get("scope")
		gotClientID = r.Form.Get("client_id")

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"tok-basic","token_type":"Bearer"}`))
	}))
	defer server.Close()

	token, err := fetchClientCredentialsToken(
		context.Background(),
		server.URL, "my-id", "my-secret", "read:x write:y", "basic",
		0, 0,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token != "tok-basic" {
		t.Errorf("token = %q, want %q", token, "tok-basic")
	}

	expected := "Basic " + base64.StdEncoding.EncodeToString([]byte("my-id:my-secret"))
	if gotAuth != expected {
		t.Errorf("Authorization = %q, want %q", gotAuth, expected)
	}
	if gotCT != "application/x-www-form-urlencoded" {
		t.Errorf("Content-Type = %q, want application/x-www-form-urlencoded", gotCT)
	}
	if gotGrant != "client_credentials" {
		t.Errorf("grant_type = %q, want client_credentials", gotGrant)
	}
	if gotScope != "read:x write:y" {
		t.Errorf("scope = %q, want read:x write:y", gotScope)
	}
	if gotClientID != "" {
		t.Errorf("basic-auth mode should not include client_id in body, got %q", gotClientID)
	}
}

func TestFetchClientCredentialsToken_BodyAuthMethod(t *testing.T) {
	var gotAuth, gotClientID, gotClientSecret string

	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		gotAuth = r.Header.Get("Authorization")
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}
		gotClientID = r.Form.Get("client_id")
		gotClientSecret = r.Form.Get("client_secret")

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"tok-body"}`))
	}))
	defer server.Close()

	token, err := fetchClientCredentialsToken(
		context.Background(),
		server.URL, "body-id", "body-secret", "", "body",
		0, 0,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token != "tok-body" {
		t.Errorf("token = %q, want tok-body", token)
	}
	if gotAuth != "" {
		t.Errorf("body-auth mode should not set Authorization header, got %q", gotAuth)
	}
	if gotClientID != "body-id" || gotClientSecret != "body-secret" {
		t.Errorf("body credentials = (%q,%q), want (body-id,body-secret)", gotClientID, gotClientSecret)
	}
}

func TestFetchClientCredentialsToken_OmitsScopeWhenEmpty(t *testing.T) {
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}
		if _, present := r.Form["scope"]; present {
			t.Errorf("scope should be omitted when empty, but key is present")
		}
		_, _ = w.Write([]byte(`{"access_token":"x"}`))
	}))
	defer server.Close()

	_, err := fetchClientCredentialsToken(
		context.Background(),
		server.URL, "id", "secret", "", "basic",
		0, 0,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestFetchClientCredentialsToken_FailsFastOn4xx(t *testing.T) {
	var calls int32
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(nethttp.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"invalid_client"}`))
	}))
	defer server.Close()

	_, err := fetchClientCredentialsToken(
		context.Background(),
		server.URL, "id", "secret", "", "basic",
		3, 1*time.Millisecond,
	)
	if err == nil {
		t.Fatal("expected error for 401 response")
	}
	if c := atomic.LoadInt32(&calls); c != 1 {
		t.Errorf("expected exactly 1 call (fail-fast on 4xx), got %d", c)
	}
	if !strings.Contains(err.Error(), "invalid_client") {
		t.Errorf("error should include response body snippet, got: %v", err)
	}
}

func TestFetchClientCredentialsToken_RetriesOn5xxUntilExhausted(t *testing.T) {
	var calls int32
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(nethttp.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"server_error"}`))
	}))
	defer server.Close()

	_, err := fetchClientCredentialsToken(
		context.Background(),
		server.URL, "id", "secret", "", "basic",
		2, 1*time.Millisecond,
	)
	if err == nil {
		t.Fatal("expected error after retry exhaustion")
	}
	if c := atomic.LoadInt32(&calls); c != 3 {
		t.Errorf("expected 3 attempts (retry=2 + 1 initial), got %d", c)
	}
	if !strings.Contains(err.Error(), "after 3 attempts") {
		t.Errorf("error should mention attempt count, got: %v", err)
	}
}

func TestFetchClientCredentialsToken_SucceedsAfterRetry(t *testing.T) {
	var calls int32
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		n := atomic.AddInt32(&calls, 1)
		if n < 2 {
			w.WriteHeader(nethttp.StatusBadGateway)
			return
		}
		_, _ = w.Write([]byte(`{"access_token":"eventually-ok"}`))
	}))
	defer server.Close()

	token, err := fetchClientCredentialsToken(
		context.Background(),
		server.URL, "id", "secret", "", "basic",
		2, 1*time.Millisecond,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token != "eventually-ok" {
		t.Errorf("token = %q, want eventually-ok", token)
	}
	if c := atomic.LoadInt32(&calls); c != 2 {
		t.Errorf("expected 2 calls (one failure + one success), got %d", c)
	}
}

func TestFetchClientCredentialsToken_MissingAccessToken(t *testing.T) {
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		_, _ = w.Write([]byte(`{"token_type":"Bearer"}`))
	}))
	defer server.Close()

	_, err := fetchClientCredentialsToken(
		context.Background(),
		server.URL, "id", "secret", "", "basic",
		0, 0,
	)
	if err == nil {
		t.Fatal("expected error when access_token is missing")
	}
	if !strings.Contains(err.Error(), "access_token") {
		t.Errorf("error should mention missing access_token, got: %v", err)
	}
}

func TestFetchClientCredentialsToken_InvalidJSONResponse(t *testing.T) {
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		_, _ = w.Write([]byte(`not json at all`))
	}))
	defer server.Close()

	_, err := fetchClientCredentialsToken(
		context.Background(),
		server.URL, "id", "secret", "", "basic",
		0, 0,
	)
	if err == nil {
		t.Fatal("expected error on invalid JSON")
	}
}

func TestFetchClientCredentialsToken_ValidationErrors(t *testing.T) {
	cases := []struct {
		name                                         string
		tokenURL, clientID, clientSecret, authMethod string
		wantSubstring                                string
	}{
		{"missing token_url", "", "id", "secret", "basic", "token_url"},
		{"missing client_id", "http://x", "", "secret", "basic", "client_id"},
		{"missing client_secret", "http://x", "id", "", "basic", "client_secret"},
		{"bad auth method", "http://x", "id", "secret", "garbage", "client_auth_method"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := fetchClientCredentialsToken(
				context.Background(),
				tc.tokenURL, tc.clientID, tc.clientSecret, "", tc.authMethod,
				0, 0,
			)
			if err == nil {
				t.Fatal("expected validation error")
			}
			if !strings.Contains(err.Error(), tc.wantSubstring) {
				t.Errorf("error = %v, want substring %q", err, tc.wantSubstring)
			}
		})
	}
}

func TestFetchClientCredentialsToken_DefaultsToBasicWhenAuthMethodEmpty(t *testing.T) {
	var gotAuth string
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		gotAuth = r.Header.Get("Authorization")
		_, _ = w.Write([]byte(`{"access_token":"ok"}`))
	}))
	defer server.Close()

	_, err := fetchClientCredentialsToken(
		context.Background(),
		server.URL, "id", "secret", "", "",
		0, 0,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.HasPrefix(gotAuth, "Basic ") {
		t.Errorf("empty authMethod should default to basic, got Authorization = %q", gotAuth)
	}
}

func TestFetchClientCredentialsToken_ContextCancellation(t *testing.T) {
	var calls int32
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(nethttp.StatusInternalServerError)
	}))
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())
	// Cancel during the backoff between attempts.
	go func() {
		time.Sleep(10 * time.Millisecond)
		cancel()
	}()

	_, err := fetchClientCredentialsToken(
		ctx,
		server.URL, "id", "secret", "", "basic",
		5, 100*time.Millisecond,
	)
	if err == nil {
		t.Fatal("expected error from context cancellation")
	}
}
