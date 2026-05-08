package httpcore

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	nethttp "net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Execute runs spec with retry + status-pattern handling and returns
// {"status", "status_text", "body", "headers", "duration_ms"}.
func Execute(ctx context.Context, spec RequestSpec) (map[string]any, error) {
	if spec.URL == "" {
		return nil, fmt.Errorf("url parameter is required")
	}

	method := spec.Method
	if method == "" {
		method = "GET"
	}

	timeout := spec.Timeout
	if timeout <= 0 {
		timeout = 30 * time.Second
	}

	attempts := spec.Retry + 1
	var lastErr error

	for attempt := 0; attempt < attempts; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(spec.RetryDelay):
			}
		}

		result, err := doRequest(ctx, spec, method, timeout)
		if err == nil {
			if statusCode, ok := result["status"].(int); ok {
				if shouldRaiseOnStatus(statusCode, spec.RaiseOnStatus) {
					lastErr = fmt.Errorf("status code %d matches raise_on_status pattern: %s", statusCode, spec.RaiseOnStatus)
					continue
				}
			}
			return result, nil
		}
		lastErr = err
	}

	return nil, fmt.Errorf("http request failed after %d attempts: %w", attempts, lastErr)
}

func doRequest(ctx context.Context, spec RequestSpec, method string, timeout time.Duration) (map[string]any, error) {
	requestURL := spec.URL
	if len(spec.Query) > 0 {
		u, err := url.Parse(spec.URL)
		if err != nil {
			return nil, fmt.Errorf("failed to parse url: %w", err)
		}
		q := u.Query()
		for key, value := range spec.Query {
			q.Add(key, value)
		}
		u.RawQuery = q.Encode()
		requestURL = u.String()
	}

	var bodyReader io.Reader
	if spec.Body != nil {
		switch v := spec.Body.(type) {
		case string:
			bodyReader = bytes.NewBufferString(v)
		case []byte:
			bodyReader = bytes.NewBuffer(v)
		default:
			jsonData, err := json.Marshal(v)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal request body: %w", err)
			}
			bodyReader = bytes.NewBuffer(jsonData)
		}
	}

	req, err := nethttp.NewRequestWithContext(ctx, method, requestURL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}

	for key, value := range spec.Headers {
		req.Header.Set(key, value)
	}
	if spec.Body != nil && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	transport := &nethttp.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: spec.IgnoreSSL},
	}
	client := &nethttp.Client{Timeout: timeout, Transport: transport}

	startTime := time.Now()
	resp, err := client.Do(req)
	duration := time.Since(startTime)
	if err != nil {
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	responseHeaders := make(map[string]string)
	for key, values := range resp.Header {
		if len(values) > 0 {
			responseHeaders[key] = values[0]
		}
	}

	var parsedBody interface{}
	if len(responseBody) > 0 {
		if err := json.Unmarshal(responseBody, &parsedBody); err != nil {
			parsedBody = string(responseBody)
		}
	} else {
		parsedBody = ""
	}

	return map[string]any{
		"status":      resp.StatusCode,
		"status_text": resp.Status,
		"body":        parsedBody,
		"headers":     responseHeaders,
		"duration_ms": duration.Milliseconds(),
	}, nil
}

// shouldRaiseOnStatus accepts patterns like "4xx", "404", "404,500",
// and legacy "404 or 500" / "4xx and 401" boolean forms.
func shouldRaiseOnStatus(statusCode int, raiseOnStatus string) bool {
	if raiseOnStatus == "" {
		return false
	}

	pattern := strings.TrimSpace(strings.ToLower(raiseOnStatus))

	if strings.Contains(pattern, ",") {
		for _, p := range strings.Split(pattern, ",") {
			if matchesPattern(statusCode, strings.TrimSpace(p)) {
				return true
			}
		}
		return false
	}

	if strings.Contains(pattern, " or ") {
		for _, p := range strings.Split(pattern, " or ") {
			if matchesPattern(statusCode, strings.TrimSpace(p)) {
				return true
			}
		}
		return false
	}

	if strings.Contains(pattern, " and ") {
		for _, p := range strings.Split(pattern, " and ") {
			if !matchesPattern(statusCode, strings.TrimSpace(p)) {
				return false
			}
		}
		return true
	}

	return matchesPattern(statusCode, pattern)
}

func matchesPattern(statusCode int, pattern string) bool {
	switch pattern {
	case "4xx":
		return statusCode >= 400 && statusCode < 500
	case "5xx":
		return statusCode >= 500 && statusCode < 600
	case "2xx":
		return statusCode >= 200 && statusCode < 300
	case "3xx":
		return statusCode >= 300 && statusCode < 400
	default:
		if code, err := strconv.Atoi(pattern); err == nil {
			return statusCode == code
		}
		return false
	}
}
