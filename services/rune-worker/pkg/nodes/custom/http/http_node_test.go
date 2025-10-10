package http

import (
	"context"
	"encoding/json"
	nethttp "net/http"
	"net/http/httptest"
	"testing"
	"time"

	"rune-worker/plugin"
)

func TestHTTPNode_BasicGETRequest(t *testing.T) {
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		if r.Method != "GET" {
			t.Errorf("Expected GET request, got %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(nethttp.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"message": "success"})
	}))
	defer server.Close()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-1",
		WorkflowID:  "test-workflow-1",
		NodeID:      "http-node-1",
		Type:        "http",
		Parameters: map[string]any{
			"method": "GET",
			"url":    server.URL,
		},
		Input: map[string]any{},
	}

	node := NewHTTPNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if status, ok := result["status"].(int); !ok || status != 200 {
		t.Errorf("Expected status 200, got %v", result["status"])
	}
}

func TestHTTPNode_RaiseOnStatusCommaSeparated(t *testing.T) {
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		w.WriteHeader(nethttp.StatusNotFound)
		w.Write([]byte("Not Found"))
	}))
	defer server.Close()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-2",
		WorkflowID:  "test-workflow-2",
		NodeID:      "http-node-2",
		Type:        "http",
		Parameters: map[string]any{
			"method":          "GET",
			"url":             server.URL,
			"raise_on_status": "4xx,5xx",
		},
		Input: map[string]any{},
	}

	node := NewHTTPNode(execCtx)
	_, err := node.Execute(context.Background(), execCtx)

	if err == nil {
		t.Error("Expected error for '4xx,5xx' pattern with 404 status, got nil")
	}
}

func TestHTTPNode_RaiseOnStatus5xxWithCommaSeparated(t *testing.T) {
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		w.WriteHeader(nethttp.StatusInternalServerError)
		w.Write([]byte("Server Error"))
	}))
	defer server.Close()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-3",
		WorkflowID:  "test-workflow-3",
		NodeID:      "http-node-3",
		Type:        "http",
		Parameters: map[string]any{
			"method":          "GET",
			"url":             server.URL,
			"raise_on_status": "4xx,5xx",
		},
		Input: map[string]any{},
	}

	node := NewHTTPNode(execCtx)
	_, err := node.Execute(context.Background(), execCtx)

	if err == nil {
		t.Error("Expected error for '4xx,5xx' pattern with 500 status, got nil")
	}
}

func TestHTTPNode_RaiseOnStatusNoMatch(t *testing.T) {
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		w.WriteHeader(nethttp.StatusOK)
		w.Write([]byte("OK"))
	}))
	defer server.Close()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-4",
		WorkflowID:  "test-workflow-4",
		NodeID:      "http-node-4",
		Type:        "http",
		Parameters: map[string]any{
			"method":          "GET",
			"url":             server.URL,
			"raise_on_status": "4xx,5xx",
		},
		Input: map[string]any{},
	}

	node := NewHTTPNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error for 200 status with '4xx,5xx' pattern, got %v", err)
	}

	if status, ok := result["status"].(int); !ok || status != 200 {
		t.Errorf("Expected status 200, got %v", result["status"])
	}
}

func TestHTTPNode_RaiseOnStatusSpecificCode(t *testing.T) {
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		w.WriteHeader(nethttp.StatusNotFound)
		w.Write([]byte("Not Found"))
	}))
	defer server.Close()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-5",
		WorkflowID:  "test-workflow-5",
		NodeID:      "http-node-5",
		Type:        "http",
		Parameters: map[string]any{
			"method":          "GET",
			"url":             server.URL,
			"raise_on_status": "404,500",
		},
		Input: map[string]any{},
	}

	node := NewHTTPNode(execCtx)
	_, err := node.Execute(context.Background(), execCtx)

	if err == nil {
		t.Error("Expected error for '404,500' pattern with 404 status, got nil")
	}
}

func TestHTTPNode_RetryLogicWithRaiseOnStatus(t *testing.T) {
	attemptCount := 0
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		attemptCount++
		if attemptCount < 3 {
			w.WriteHeader(nethttp.StatusInternalServerError)
			w.Write([]byte("Server Error"))
		} else {
			w.WriteHeader(nethttp.StatusOK)
			json.NewEncoder(w).Encode(map[string]string{"message": "success"})
		}
	}))
	defer server.Close()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-6",
		WorkflowID:  "test-workflow-6",
		NodeID:      "http-node-6",
		Type:        "http",
		Parameters: map[string]any{
			"method":          "GET",
			"url":             server.URL,
			"retry":           "3",
			"retry_delay":     "0",
			"raise_on_status": "5xx",
		},
		Input: map[string]any{},
	}

	node := NewHTTPNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error after retries, got %v", err)
	}

	if attemptCount != 3 {
		t.Errorf("Expected 3 attempts, got %d", attemptCount)
	}

	if status, ok := result["status"].(int); !ok || status != 200 {
		t.Errorf("Expected status 200, got %v", result["status"])
	}
}

func TestHTTPNode_POSTWithBody(t *testing.T) {
	var receivedBody map[string]interface{}
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		if r.Method != "POST" {
			t.Errorf("Expected POST request, got %s", r.Method)
		}
		json.NewDecoder(r.Body).Decode(&receivedBody)
		w.WriteHeader(nethttp.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"status": "created"})
	}))
	defer server.Close()

	testBody := map[string]interface{}{
		"name":  "John Doe",
		"email": "john@example.com",
	}

	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-7",
		WorkflowID:  "test-workflow-7",
		NodeID:      "http-node-7",
		Type:        "http",
		Parameters: map[string]any{
			"method": "POST",
			"url":    server.URL,
			"body":   testBody,
		},
		Input: map[string]any{},
	}

	node := NewHTTPNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if status, ok := result["status"].(int); !ok || status != 201 {
		t.Errorf("Expected status 201, got %v", result["status"])
	}
}

func TestHTTPNode_CustomHeaders(t *testing.T) {
	var receivedHeaders nethttp.Header
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		receivedHeaders = r.Header
		w.WriteHeader(nethttp.StatusOK)
		w.Write([]byte("OK"))
	}))
	defer server.Close()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-8",
		WorkflowID:  "test-workflow-8",
		NodeID:      "http-node-8",
		Type:        "http",
		Parameters: map[string]any{
			"method": "GET",
			"url":    server.URL,
			"headers": map[string]interface{}{
				"X-Custom-Header": "custom-value",
				"Authorization":   "Bearer token123",
			},
		},
		Input: map[string]any{},
	}

	node := NewHTTPNode(execCtx)
	_, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if receivedHeaders.Get("X-Custom-Header") != "custom-value" {
		t.Errorf("Expected X-Custom-Header to be 'custom-value', got %s", receivedHeaders.Get("X-Custom-Header"))
	}
}

func TestHTTPNode_QueryParameters(t *testing.T) {
	var receivedQuery string
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		receivedQuery = r.URL.RawQuery
		w.WriteHeader(nethttp.StatusOK)
		w.Write([]byte("OK"))
	}))
	defer server.Close()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-9",
		WorkflowID:  "test-workflow-9",
		NodeID:      "http-node-9",
		Type:        "http",
		Parameters: map[string]any{
			"method": "GET",
			"url":    server.URL,
			"query": map[string]interface{}{
				"user_id": "123",
				"active":  "true",
			},
		},
		Input: map[string]any{},
	}

	node := NewHTTPNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if receivedQuery == "" {
		t.Error("Expected query parameters to be sent")
	}

	if status, ok := result["status"].(int); !ok || status != 200 {
		t.Errorf("Expected status 200, got %v", result["status"])
	}
}

func TestHTTPNode_Timeout(t *testing.T) {
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		time.Sleep(2 * time.Second)
		w.WriteHeader(nethttp.StatusOK)
	}))
	defer server.Close()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-10",
		WorkflowID:  "test-workflow-10",
		NodeID:      "http-node-10",
		Type:        "http",
		Parameters: map[string]any{
			"method":  "GET",
			"url":     server.URL,
			"timeout": "1",
		},
		Input: map[string]any{},
	}

	node := NewHTTPNode(execCtx)
	_, err := node.Execute(context.Background(), execCtx)

	if err == nil {
		t.Error("Expected timeout error, got nil")
	}
}

func TestHTTPNode_SSLVerification(t *testing.T) {
	server := httptest.NewTLSServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		w.WriteHeader(nethttp.StatusOK)
		w.Write([]byte("OK"))
	}))
	defer server.Close()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-11",
		WorkflowID:  "test-workflow-11",
		NodeID:      "http-node-11",
		Type:        "http",
		Parameters: map[string]any{
			"method":     "GET",
			"url":        server.URL,
			"ignore_ssl": true,
		},
		Input: map[string]any{},
	}

	node := NewHTTPNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	if err != nil {
		t.Fatalf("Expected no error with ignore_ssl=true, got %v", err)
	}

	if status, ok := result["status"].(int); !ok || status != 200 {
		t.Errorf("Expected status 200, got %v", result["status"])
	}
}

func TestHTTPNode_MixedPatterns(t *testing.T) {
	server := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		w.WriteHeader(nethttp.StatusBadRequest)
		w.Write([]byte("Bad Request"))
	}))
	defer server.Close()

	execCtx := plugin.ExecutionContext{
		ExecutionID: "test-exec-12",
		WorkflowID:  "test-workflow-12",
		NodeID:      "http-node-12",
		Type:        "http",
		Parameters: map[string]any{
			"method":          "GET",
			"url":             server.URL,
			"raise_on_status": "404,500,5xx",
		},
		Input: map[string]any{},
	}

	node := NewHTTPNode(execCtx)
	result, err := node.Execute(context.Background(), execCtx)

	// 400 should not match 404, 500, or 5xx
	if err != nil {
		t.Errorf("Expected no error for 400 with pattern '404,500,5xx', got %v", err)
	}

	if result != nil {
		if status, ok := result["status"].(int); !ok || status != 400 {
			t.Errorf("Expected status 400, got %v", result["status"])
		}
	}
}
