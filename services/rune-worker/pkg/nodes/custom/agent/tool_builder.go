package agent

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/google/jsonschema-go/jsonschema"
	"google.golang.org/adk/tool"
	"google.golang.org/adk/tool/functiontool"

	"rune-worker/pkg/nodes/shared/httpcore"
)

func buildTools(tools []toolConfig) ([]tool.Tool, error) {
	out := make([]tool.Tool, 0, len(tools))
	for _, tc := range tools {
		t, err := buildHTTPTool(tc)
		if err != nil {
			return nil, fmt.Errorf("tool %q: %w", tc.Name, err)
		}
		out = append(out, t)
	}
	return out, nil
}

func buildHTTPTool(tc toolConfig) (tool.Tool, error) {
	if tc.HTTP == nil {
		return nil, fmt.Errorf("missing http config")
	}
	cfg := tc.HTTP

	schema, slots := buildHTTPInputSchema(cfg)
	creds := tc.Credentials

	handler := func(ctx tool.Context, args map[string]any) (map[string]any, error) {
		spec, err := buildRequestSpec(cfg, slots, args, creds)
		if err != nil {
			return map[string]any{"error": err.Error()}, nil
		}
		result, err := httpcore.Execute(ctx, spec)
		if err != nil {
			// Surface the error to the LLM rather than aborting the whole run.
			return map[string]any{"error": err.Error()}, nil
		}
		return result, nil
	}

	return functiontool.New(
		functiontool.Config{
			Name:        tc.Name,
			Description: tc.Description,
			InputSchema: schema,
		},
		handler,
	)
}

type slotKind int

const (
	slotURL slotKind = iota
	slotHeader
	slotQuery
	slotBody
)

// agentSlot maps a JSON-schema property name back to where the LLM-supplied
// value should be inserted in the outgoing request.
type agentSlot struct {
	Property string
	Kind     slotKind
	Key      string // header/query/body key (empty for slotURL)
	Type     string
}

func buildHTTPInputSchema(cfg *httpToolConfig) (*jsonschema.Schema, []agentSlot) {
	props := map[string]*jsonschema.Schema{}
	required := []string{}
	slots := []agentSlot{}

	addSlot := func(prop string, fm fieldMode, kind slotKind, key string) {
		if fm.Mode != "agent" || fm.Agent == nil {
			return
		}
		props[prop] = &jsonschema.Schema{
			Type:        fm.Agent.Type,
			Description: fm.Agent.Description,
		}
		if fm.Agent.Required {
			required = append(required, prop)
		}
		slots = append(slots, agentSlot{
			Property: prop,
			Kind:     kind,
			Key:      key,
			Type:     fm.Agent.Type,
		})
	}

	addSlot("url", cfg.URL, slotURL, "")
	for _, h := range cfg.Headers {
		addSlot("header_"+sanitizeProp(h.Key), h.Value, slotHeader, h.Key)
	}
	for _, q := range cfg.Query {
		addSlot("query_"+sanitizeProp(q.Key), q.Value, slotQuery, q.Key)
	}
	for _, b := range cfg.Body {
		addSlot("body_"+sanitizeProp(b.Key), b.Value, slotBody, b.Key)
	}

	return &jsonschema.Schema{
		Type:       "object",
		Properties: props,
		Required:   required,
	}, slots
}

// sanitizeProp turns an arbitrary key (e.g. "X-User-Id") into a valid
// JSON-schema property name ("X_User_Id") while staying readable for the LLM.
func sanitizeProp(s string) string {
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9', c == '_':
			out = append(out, c)
		default:
			out = append(out, '_')
		}
	}
	return string(out)
}

func buildRequestSpec(cfg *httpToolConfig, slots []agentSlot, args map[string]any, creds map[string]any) (httpcore.RequestSpec, error) {
	spec := httpcore.RequestSpec{
		Method:        cfg.Method,
		Headers:       map[string]string{},
		Query:         map[string]string{},
		RaiseOnStatus: cfg.RaiseOnStatus,
		IgnoreSSL:     cfg.IgnoreSSL,
		Timeout:       parseSecondsOr(cfg.Timeout, 30*time.Second),
		Retry:         parseIntOr(cfg.Retry, 0),
		RetryDelay:    parseSecondsOr(cfg.RetryDelay, 0),
	}

	if cfg.URL.Mode == "fixed" {
		if v, ok := cfg.URL.Value.(string); ok {
			spec.URL = v
		}
	}

	for _, h := range cfg.Headers {
		if h.Value.Mode == "fixed" {
			if v, ok := h.Value.Value.(string); ok {
				spec.Headers[h.Key] = v
			}
		}
	}
	for _, q := range cfg.Query {
		if q.Value.Mode == "fixed" {
			if v, ok := q.Value.Value.(string); ok {
				spec.Query[q.Key] = v
			}
		}
	}

	body := map[string]any{}
	hasFixedBody := false
	for _, b := range cfg.Body {
		if b.Value.Mode == "fixed" {
			body[b.Key] = b.Value.Value
			hasFixedBody = true
		}
	}

	for _, s := range slots {
		raw, ok := args[s.Property]
		if !ok {
			continue
		}
		switch s.Kind {
		case slotURL:
			if str, ok := raw.(string); ok {
				spec.URL = str
			}
		case slotHeader:
			spec.Headers[s.Key] = toString(raw)
		case slotQuery:
			spec.Query[s.Key] = toString(raw)
		case slotBody:
			body[s.Key] = raw
			hasFixedBody = true
		}
	}

	if hasFixedBody {
		spec.Body = body
	}

	httpcore.ApplyCredential(spec.Headers, creds)

	if spec.URL == "" {
		return spec, fmt.Errorf("url is empty")
	}
	return spec, nil
}

func toString(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case bool:
		return strconv.FormatBool(x)
	case float64:
		return strconv.FormatFloat(x, 'f', -1, 64)
	case int:
		return strconv.Itoa(x)
	case int64:
		return strconv.FormatInt(x, 10)
	default:
		b, err := json.Marshal(v)
		if err != nil {
			return ""
		}
		return string(b)
	}
}

func parseIntOr(s string, def int) int {
	if s == "" {
		return def
	}
	if n, err := strconv.Atoi(s); err == nil {
		return n
	}
	return def
}

func parseSecondsOr(s string, def time.Duration) time.Duration {
	if s == "" {
		return def
	}
	if n, err := strconv.Atoi(s); err == nil {
		return time.Duration(n) * time.Second
	}
	return def
}
