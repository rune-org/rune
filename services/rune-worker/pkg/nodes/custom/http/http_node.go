package http

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	nethttp "net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"rune-worker/pkg/nodes"
	"rune-worker/plugin"
)

// HTTPNode executes HTTP requests to external APIs with support for
// retries, timeouts, status code checking, and SSL verification toggling.
type HTTPNode struct {
	method        string
	url           string
	body          interface{}
	query         map[string]string
	headers       map[string]string
	retry         int
	retryDelay    time.Duration
	timeout       time.Duration
	raiseOnStatus string
	ignoreSSL     bool
}

// NewHTTPNode creates a new HTTPNode instance from execution context parameters.
func NewHTTPNode(execCtx plugin.ExecutionContext) *HTTPNode {
	node := &HTTPNode{
		method:     "GET",
		timeout:    30 * time.Second,
		retry:      0,
		retryDelay: 0,
		ignoreSSL:  false,
		query:      make(map[string]string),
		headers:    make(map[string]string),
	}

	// Parse method
	if method, ok := execCtx.Parameters["method"].(string); ok {
		node.method = strings.ToUpper(method)
	}

	// Parse URL
	if urlStr, ok := execCtx.Parameters["url"].(string); ok {
		node.url = urlStr
	}

	// Parse body
	if body, ok := execCtx.Parameters["body"]; ok {
		if m, ok := body.(map[string]interface{}); !ok || len(m) > 0 {
			node.body = body
		}
	}

	// Parse query parameters
	if query, ok := execCtx.Parameters["query"].(map[string]interface{}); ok {
		for k, v := range query {
			if strVal, ok := v.(string); ok {
				node.query[k] = strVal
			}
		}
	}

	// Parse headers
	if headers, ok := execCtx.Parameters["headers"].(map[string]interface{}); ok {
		for k, v := range headers {
			if strVal, ok := v.(string); ok {
				node.headers[k] = strVal
			}
		}
	}

	// Inject credentials into headers if available
	creds := execCtx.GetCredentials()
	if len(creds) > 0 {
		if credType, ok := creds["type"].(string); ok {
			switch credType {
			case "basic_auth":
				if _, exists := node.headers["Authorization"]; !exists {
					username, _ := creds["username"].(string)
					password, _ := creds["password"].(string)
					if username != "" && password != "" {
						auth := username + ":" + password
						encodedAuth := base64.StdEncoding.EncodeToString([]byte(auth))
						node.headers["Authorization"] = "Basic " + encodedAuth
					}
				}
			case "header":
				field, _ := creds["field"].(string)
				value, _ := creds["value"].(string)
				if field != "" && value != "" {
					if _, exists := node.headers[field]; !exists {
						node.headers[field] = value
					}
				}
			}
		}
	}

	// Parse retry count
	if retryStr, ok := execCtx.Parameters["retry"].(string); ok {
		if retry, err := strconv.Atoi(retryStr); err == nil {
			node.retry = retry
		}
	} else if retry, ok := execCtx.Parameters["retry"].(float64); ok {
		node.retry = int(retry)
	} else if retry, ok := execCtx.Parameters["retry"].(int); ok {
		node.retry = retry
	}

	// Parse retry delay
	if retryDelayStr, ok := execCtx.Parameters["retry_delay"].(string); ok {
		if retryDelay, err := strconv.Atoi(retryDelayStr); err == nil {
			node.retryDelay = time.Duration(retryDelay) * time.Second
		}
	} else if retryDelay, ok := execCtx.Parameters["retry_delay"].(float64); ok {
		node.retryDelay = time.Duration(retryDelay) * time.Second
	} else if retryDelay, ok := execCtx.Parameters["retry_delay"].(int); ok {
		node.retryDelay = time.Duration(retryDelay) * time.Second
	}

	// Parse timeout
	if timeoutStr, ok := execCtx.Parameters["timeout"].(string); ok {
		if timeout, err := strconv.Atoi(timeoutStr); err == nil {
			node.timeout = time.Duration(timeout) * time.Second
		}
	} else if timeout, ok := execCtx.Parameters["timeout"].(float64); ok {
		node.timeout = time.Duration(timeout) * time.Second
	} else if timeout, ok := execCtx.Parameters["timeout"].(int); ok {
		node.timeout = time.Duration(timeout) * time.Second
	}

	// Parse raise_on_status
	if raiseOnStatus, ok := execCtx.Parameters["raise_on_status"].(string); ok {
		node.raiseOnStatus = raiseOnStatus
	}

	// Parse ignore_ssl
	if ignoreSSL, ok := execCtx.Parameters["ignore_ssl"].(bool); ok {
		node.ignoreSSL = ignoreSSL
	}

	return node
}

// Execute runs the HTTP request with retry logic and validation.
func (n *HTTPNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	if n.url == "" {
		return nil, fmt.Errorf("url parameter is required")
	}

	var lastErr error
	attempts := n.retry + 1 // Initial attempt + retries

	for attempt := 0; attempt < attempts; attempt++ {
		if attempt > 0 {
			// Wait before retrying
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(n.retryDelay):
			}
		}

		result, err := n.executeRequest(ctx)
		if err == nil {
			// Check if we should raise an error based on status code
			if statusCode, ok := result["status"].(int); ok {
				if n.shouldRaiseOnStatus(statusCode) {
					lastErr = fmt.Errorf("status code %d matches raise_on_status pattern: %s", statusCode, n.raiseOnStatus)
					continue // Retry if configured
				}
			}
			return result, nil
		}
		lastErr = err
	}

	return nil, fmt.Errorf("http request failed after %d attempts: %w", attempts, lastErr)
}

// executeRequest performs a single HTTP request.
func (n *HTTPNode) executeRequest(ctx context.Context) (map[string]any, error) {
	// Build URL with query parameters
	requestURL := n.url
	if len(n.query) > 0 {
		u, err := url.Parse(n.url)
		if err != nil {
			return nil, fmt.Errorf("failed to parse url: %w", err)
		}
		q := u.Query()
		for key, value := range n.query {
			q.Add(key, value)
		}
		u.RawQuery = q.Encode()
		requestURL = u.String()
	}

	// Prepare request body
	var bodyReader io.Reader
	if n.body != nil {
		switch v := n.body.(type) {
		case string:
			bodyReader = bytes.NewBufferString(v)
		case []byte:
			bodyReader = bytes.NewBuffer(v)
		default:
			// Marshal any other type as JSON
			jsonData, err := json.Marshal(v)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal request body: %w", err)
			}
			bodyReader = bytes.NewBuffer(jsonData)
		}
	}

	// Create HTTP request
	req, err := nethttp.NewRequestWithContext(ctx, n.method, requestURL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}

	// Set headers
	for key, value := range n.headers {
		req.Header.Set(key, value)
	}

	// Set default Content-Type if not specified and body exists
	if n.body != nil && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	// Configure HTTP client with SSL verification setting
	transport := &nethttp.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: n.ignoreSSL,
		},
	}

	client := &nethttp.Client{
		Timeout:   n.timeout,
		Transport: transport,
	}

	// Execute request
	startTime := time.Now()
	resp, err := client.Do(req)
	duration := time.Since(startTime)

	if err != nil {
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	// Read response body
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Parse response headers
	responseHeaders := make(map[string]string)
	for key, values := range resp.Header {
		if len(values) > 0 {
			responseHeaders[key] = values[0]
		}
	}

	// Try to parse body as JSON, fall back to string
	var parsedBody interface{}
	if len(responseBody) > 0 {
		if err := json.Unmarshal(responseBody, &parsedBody); err != nil {
			// Not JSON, use string
			parsedBody = string(responseBody)
		}
	} else {
		parsedBody = ""
	}

	// Build result matching the RFC specification
	result := map[string]any{
		"status":      resp.StatusCode,
		"status_text": resp.Status,
		"body":        parsedBody,
		"headers":     responseHeaders,
		"duration_ms": duration.Milliseconds(),
	}

	return result, nil
}

// shouldRaiseOnStatus checks if the status code matches the raise_on_status pattern.
// Supports comma-separated patterns (e.g., "4xx,5xx") or single patterns (e.g., "404").
func (n *HTTPNode) shouldRaiseOnStatus(statusCode int) bool {
	if n.raiseOnStatus == "" {
		return false
	}

	pattern := strings.TrimSpace(strings.ToLower(n.raiseOnStatus))

	// Handle comma-separated patterns (e.g., "4xx,5xx")
	if strings.Contains(pattern, ",") {
		patterns := strings.Split(pattern, ",")
		for _, p := range patterns {
			if n.matchesPattern(statusCode, strings.TrimSpace(p)) {
				return true
			}
		}
		return false
	}

	// Handle "or" operator (legacy support)
	if strings.Contains(pattern, " or ") {
		patterns := strings.Split(pattern, " or ")
		for _, p := range patterns {
			if n.matchesPattern(statusCode, strings.TrimSpace(p)) {
				return true
			}
		}
		return false
	}

	// Handle "and" operator
	if strings.Contains(pattern, " and ") {
		patterns := strings.Split(pattern, " and ")
		for _, p := range patterns {
			if !n.matchesPattern(statusCode, strings.TrimSpace(p)) {
				return false
			}
		}
		return true
	}

	// Single pattern
	return n.matchesPattern(statusCode, pattern)
}

// matchesPattern checks if a status code matches a specific pattern.
func (n *HTTPNode) matchesPattern(statusCode int, pattern string) bool {
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
		// Try to parse as specific status code
		if code, err := strconv.Atoi(pattern); err == nil {
			return statusCode == code
		}
		return false
	}
}

// init registers the HTTP node type automatically on package import.
func init() {
	nodes.RegisterNodeType(RegisterHTTP)
}

// RegisterHTTP registers the HTTP node type with the registry.
func RegisterHTTP(reg *nodes.Registry) {
	reg.Register("http", func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewHTTPNode(execCtx)
	})
}
