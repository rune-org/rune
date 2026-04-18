package http

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	nethttp "net/http"
	"net/url"
	"strings"
	"time"
)

const oauth2ResponseBodySnippetMax = 500

// fetchClientCredentialsToken performs an OAuth 2.0 client_credentials token
// exchange and returns the resulting access_token. It does not cache, refresh,
// or inspect expiry — callers are expected to invoke it per request.
//
// authMethod selects how client_id and client_secret are transmitted:
//   - "basic": HTTP Basic header (client_secret_basic), no credentials in body.
//   - "body":  as form fields in the POST body (client_secret_post).
//
// Retries are performed on network errors and 5xx responses up to `retry`
// additional attempts (total attempts = retry + 1). 4xx responses fail fast
// because bad credentials will not succeed on retry.
func fetchClientCredentialsToken(
	ctx context.Context,
	tokenURL, clientID, clientSecret, scope, authMethod string,
	retry int,
	retryDelay time.Duration,
) (string, error) {
	if tokenURL == "" {
		return "", fmt.Errorf("oauth2: token_url is required")
	}
	if clientID == "" {
		return "", fmt.Errorf("oauth2: client_id is required")
	}
	if clientSecret == "" {
		return "", fmt.Errorf("oauth2: client_secret is required")
	}
	if authMethod == "" {
		authMethod = "basic"
	}
	if authMethod != "basic" && authMethod != "body" {
		return "", fmt.Errorf("oauth2: unsupported client_auth_method %q (expected 'basic' or 'body')", authMethod)
	}

	attempts := retry + 1
	var lastErr error

	for attempt := 0; attempt < attempts; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(retryDelay):
			}
		}

		token, statusCode, err := doTokenRequest(ctx, tokenURL, clientID, clientSecret, scope, authMethod)
		if err == nil {
			return token, nil
		}

		lastErr = err

		// Fail fast on 4xx — bad credentials will not improve with retries.
		if statusCode >= 400 && statusCode < 500 {
			return "", fmt.Errorf("oauth2 token fetch failed: %w", err)
		}
	}

	return "", fmt.Errorf("oauth2 token fetch failed after %d attempts: %w", attempts, lastErr)
}

// doTokenRequest performs a single token exchange attempt. It returns the
// access token on success, or an error with the response status code so the
// caller can decide whether to retry.
func doTokenRequest(
	ctx context.Context,
	tokenURL, clientID, clientSecret, scope, authMethod string,
) (string, int, error) {
	form := url.Values{}
	form.Set("grant_type", "client_credentials")
	if scope != "" {
		form.Set("scope", scope)
	}
	if authMethod == "body" {
		form.Set("client_id", clientID)
		form.Set("client_secret", clientSecret)
	}

	req, err := nethttp.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", 0, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	if authMethod == "basic" {
		creds := base64.StdEncoding.EncodeToString([]byte(clientID + ":" + clientSecret))
		req.Header.Set("Authorization", "Basic "+creds)
	}

	resp, err := nethttp.DefaultClient.Do(req)
	if err != nil {
		return "", 0, fmt.Errorf("request: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", resp.StatusCode, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", resp.StatusCode, fmt.Errorf("token endpoint returned %d: %s", resp.StatusCode, truncateBody(body))
	}

	var parsed struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", resp.StatusCode, fmt.Errorf("parse response: %w (body: %s)", err, truncateBody(body))
	}
	if parsed.AccessToken == "" {
		return "", resp.StatusCode, fmt.Errorf("token endpoint response missing access_token (body: %s)", truncateBody(body))
	}

	return parsed.AccessToken, resp.StatusCode, nil
}

func truncateBody(body []byte) string {
	if len(body) <= oauth2ResponseBodySnippetMax {
		return string(body)
	}
	return string(body[:oauth2ResponseBodySnippetMax]) + "..."
}
