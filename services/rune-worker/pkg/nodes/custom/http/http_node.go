package http

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"rune-worker/pkg/nodes"
	"rune-worker/pkg/nodes/shared/httpcore"
	"rune-worker/plugin"
)

// HTTPNode is a thin adapter; the request pipeline lives in pkg/nodes/shared/httpcore.
type HTTPNode struct {
	spec httpcore.RequestSpec
}

func NewHTTPNode(execCtx plugin.ExecutionContext) *HTTPNode {
	spec := httpcore.RequestSpec{
		Method:     "GET",
		Timeout:    30 * time.Second,
		Retry:      0,
		RetryDelay: 0,
		IgnoreSSL:  false,
		Query:      make(map[string]string),
		Headers:    make(map[string]string),
	}

	if method, ok := execCtx.Parameters["method"].(string); ok {
		spec.Method = strings.ToUpper(method)
	}

	if urlStr, ok := execCtx.Parameters["url"].(string); ok {
		spec.URL = urlStr
	}

	if body, ok := execCtx.Parameters["body"]; ok {
		if m, ok := body.(map[string]interface{}); !ok || len(m) > 0 {
			spec.Body = body
		}
	}

	if query, ok := execCtx.Parameters["query"].(map[string]interface{}); ok {
		for k, v := range query {
			if strVal, ok := v.(string); ok {
				spec.Query[k] = strVal
			}
		}
	}

	if headers, ok := execCtx.Parameters["headers"].(map[string]interface{}); ok {
		for k, v := range headers {
			if strVal, ok := v.(string); ok {
				spec.Headers[k] = strVal
			}
		}
	}

	httpcore.ApplyCredential(spec.Headers, execCtx.GetCredentials())

	spec.Retry = parseIntParam(execCtx.Parameters["retry"], 0)
	spec.RetryDelay = time.Duration(parseIntParam(execCtx.Parameters["retry_delay"], 0)) * time.Second
	spec.Timeout = time.Duration(parseIntParam(execCtx.Parameters["timeout"], 30)) * time.Second

	if raiseOnStatus, ok := execCtx.Parameters["raise_on_status"].(string); ok {
		spec.RaiseOnStatus = raiseOnStatus
	}

	if ignoreSSL, ok := execCtx.Parameters["ignore_ssl"].(bool); ok {
		spec.IgnoreSSL = ignoreSSL
	}

	return &HTTPNode{spec: spec}
}

// parseIntParam handles a value arriving as string, float64, or int.
func parseIntParam(v any, def int) int {
	switch x := v.(type) {
	case string:
		if n, err := strconv.Atoi(x); err == nil {
			return n
		}
	case float64:
		return int(x)
	case int:
		return x
	}
	return def
}

func (n *HTTPNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	if n.spec.URL == "" {
		return nil, fmt.Errorf("url parameter is required")
	}
	return httpcore.Execute(ctx, n.spec)
}

func init() {
	nodes.RegisterNodeType(RegisterHTTP)
}

func RegisterHTTP(reg *nodes.Registry) {
	reg.Register("http", func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewHTTPNode(execCtx)
	})
}
