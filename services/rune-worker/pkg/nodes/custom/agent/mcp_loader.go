package agent

import (
	"encoding/base64"
	"fmt"
	nethttp "net/http"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"google.golang.org/adk/tool"
	"google.golang.org/adk/tool/mcptoolset"
)

// buildMCPToolsets returns one ADK toolset per server. Connections are lazy
// (mcptoolset.New does not dial) so a bad URL fails on first tool call, not here.
func buildMCPToolsets(servers []mcpServerConfig) ([]tool.Toolset, error) {
	out := make([]tool.Toolset, 0, len(servers))
	for _, s := range servers {
		ts, err := buildOneMCPToolset(s)
		if err != nil {
			return nil, fmt.Errorf("mcp server %q: %w", s.Name, err)
		}
		out = append(out, ts)
	}
	return out, nil
}

func buildOneMCPToolset(s mcpServerConfig) (tool.Toolset, error) {
	transport, err := buildMCPTransport(s)
	if err != nil {
		return nil, err
	}
	return mcptoolset.New(mcptoolset.Config{Transport: transport})
}

func buildMCPTransport(s mcpServerConfig) (mcp.Transport, error) {
	httpClient := &nethttp.Client{}
	if s.Credentials != nil {
		extraHeaders := credentialAsHeaders(s.Credentials)
		if len(extraHeaders) > 0 {
			httpClient.Transport = &headerInjector{
				base:    nethttp.DefaultTransport,
				headers: extraHeaders,
			}
		}
	}

	switch s.Transport {
	case "sse":
		return &mcp.SSEClientTransport{Endpoint: s.URL, HTTPClient: httpClient}, nil
	case "streamable_http", "":
		return &mcp.StreamableClientTransport{Endpoint: s.URL, HTTPClient: httpClient}, nil
	default:
		return nil, fmt.Errorf("unsupported transport %q (expected \"sse\" or \"streamable_http\")", s.Transport)
	}
}

type headerInjector struct {
	base    nethttp.RoundTripper
	headers map[string]string
}

func (h *headerInjector) RoundTrip(req *nethttp.Request) (*nethttp.Response, error) {
	// http.RoundTripper contract: must not mutate the incoming request.
	clone := req.Clone(req.Context())
	for k, v := range h.headers {
		if clone.Header.Get(k) == "" {
			clone.Header.Set(k, v)
		}
	}
	return h.base.RoundTrip(clone)
}

// credentialAsHeaders mirrors httpcore.ApplyCredential's behavior, returning
// the headers to attach instead of mutating an existing map.
func credentialAsHeaders(cred map[string]any) map[string]string {
	values, ok := cred["values"].(map[string]any)
	if !ok {
		values = cred
	}
	credType, _ := cred["type"].(string)

	out := map[string]string{}
	switch credType {
	case "header":
		field, _ := values["field"].(string)
		value, _ := values["value"].(string)
		if field != "" && value != "" {
			out[field] = value
		}
	case "basic_auth":
		user, _ := values["username"].(string)
		pass, _ := values["password"].(string)
		if user != "" && pass != "" {
			out["Authorization"] = "Basic " + base64.StdEncoding.EncodeToString([]byte(user+":"+pass))
		}
	case "token":
		if t, _ := values["token"].(string); t != "" {
			out["Authorization"] = "Bearer " + t
		}
	case "api_key":
		field, _ := values["key"].(string)
		value, _ := values["value"].(string)
		if value == "" {
			break
		}
		if field != "" {
			out[field] = value
		} else {
			out["Authorization"] = "Bearer " + value
		}
	}
	return out
}
