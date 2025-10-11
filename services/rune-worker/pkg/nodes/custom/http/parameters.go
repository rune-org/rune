package http

// HTTPParameters defines configuration for HTTP request nodes.
type HTTPParameters struct {
	Method        string            `json:"method"`
	URL           string            `json:"url"`
	Body          any               `json:"body"` // JSON body, can be any type
	Query         map[string]string `json:"query"`
	Headers       map[string]string `json:"headers"`
	Retry         int               `json:"retry,string"`
	RetryDelay    int               `json:"retry_delay,string"`
	Timeout       int               `json:"timeout,string"`
	RaiseOnStatus string            `json:"raise_on_status"` // e.g., "4xx or 5xx"
	IgnoreSSL     bool              `json:"ignore_ssl"`
}
