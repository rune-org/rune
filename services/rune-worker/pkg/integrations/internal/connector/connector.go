package connector

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"rune-worker/pkg/nodes/shared/httpcore"
	"rune-worker/plugin"
)

type Spec struct {
	Method      string
	BaseURL     string
	Path        string
	PathArgs    map[string]string
	Query       map[string]string
	Headers     map[string]string
	Body        any
	Timeout     time.Duration
	AllowNon2xx bool
}

type Error struct {
	Status int
	URL    string
	Body   any
}

func (e *Error) Error() string {
	return fmt.Sprintf("integration request failed: status=%d url=%s body=%v", e.Status, e.URL, e.Body)
}

func Do(ctx context.Context, ec plugin.ExecutionContext, s Spec) (map[string]any, error) {
	fullURL, err := buildURL(s.BaseURL, s.Path, s.PathArgs)
	if err != nil {
		return nil, err
	}

	headers := cloneHeaders(s.Headers)
	httpcore.ApplyCredential(headers, ec.GetCredentials())

	spec := httpcore.RequestSpec{
		Method:  s.Method,
		URL:     fullURL,
		Body:    s.Body,
		Query:   s.Query,
		Headers: headers,
		Timeout: s.Timeout,
	}
	if spec.Timeout <= 0 {
		spec.Timeout = 30 * time.Second
	}

	raw, err := httpcore.Execute(ctx, spec)
	if err != nil {
		return nil, err
	}

	status, _ := raw["status"].(int)
	if !s.AllowNon2xx && (status < 200 || status >= 300) {
		return nil, &Error{
			Status: status,
			URL:    fullURL,
			Body:   raw["body"],
		}
	}

	return raw, nil
}

func cloneHeaders(in map[string]string) map[string]string {
	if in == nil {
		return map[string]string{}
	}
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

func buildURL(baseURL, path string, pathArgs map[string]string) (string, error) {
	if baseURL == "" {
		return "", fmt.Errorf("base url is required")
	}
	if path == "" {
		return "", fmt.Errorf("path is required")
	}

	resolvedPath, err := resolvePath(path, pathArgs)
	if err != nil {
		return "", err
	}

	base, err := url.Parse(baseURL)
	if err != nil {
		return "", fmt.Errorf("invalid base url: %w", err)
	}
	rel, err := url.Parse(resolvedPath)
	if err != nil {
		return "", fmt.Errorf("invalid path: %w", err)
	}
	return base.ResolveReference(rel).String(), nil
}

func resolvePath(path string, pathArgs map[string]string) (string, error) {
	var b strings.Builder
	for i := 0; i < len(path); i++ {
		ch := path[i]
		if ch != '{' {
			b.WriteByte(ch)
			continue
		}

		end := strings.IndexByte(path[i+1:], '}')
		if end < 0 {
			return "", fmt.Errorf("unclosed path variable in %q", path)
		}
		end += i + 1
		key := path[i+1 : end]
		val, ok := pathArgs[key]
		if !ok {
			return "", fmt.Errorf("missing path argument %q", key)
		}
		b.WriteString(url.PathEscape(val))
		i = end
	}
	return b.String(), nil
}
