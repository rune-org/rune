// Package agent implements an LLM agent node backed by Google's ADK Go SDK.
// v0: Gemini only; http_request tool type only; MCP over SSE / Streamable HTTP.
package agent

type modelConfig struct {
	Provider    string
	Name        string
	Backend     string // gemini-only: "" | "ai_studio" | "vertex" — picks google.golang.org/genai backend
	Temperature *float32
}

type message struct {
	Role    string // "user" | "model"
	Content string
}

// fieldMode lets a tool field be either fixed by the workflow author or
// supplied by the agent at call time (becomes a JSON-schema property).
type fieldMode struct {
	Mode  string      // "fixed" | "agent"
	Value any         // when Mode=="fixed"
	Agent *agentField // when Mode=="agent"
}

type agentField struct {
	Description string
	Type        string // "string" | "number" | "boolean" | "object"
	Required    bool
}

type kvField struct {
	Key   string
	Value fieldMode
}

type httpToolConfig struct {
	Method        string
	URL           fieldMode
	Headers       []kvField
	Query         []kvField
	Body          []kvField
	Timeout       string
	Retry         string
	RetryDelay    string
	RaiseOnStatus string
	IgnoreSSL     bool
}

type toolConfig struct {
	Type        string // v0: "http_request"
	Name        string
	Description string
	Credentials map[string]any // resolved by master
	HTTP        *httpToolConfig
}

type mcpServerConfig struct {
	Name        string
	Transport   string // "sse" | "streamable_http"
	URL         string
	Credentials map[string]any // resolved by master
}

type agentParams struct {
	Model        modelConfig
	SystemPrompt string
	Messages     []message
	Tools        []toolConfig
	MCPServers   []mcpServerConfig
}
