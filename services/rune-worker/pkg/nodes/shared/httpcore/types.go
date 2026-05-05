// Package httpcore is the HTTP request pipeline shared by the http node and
// the agent's http_request tool, so behavior cannot drift between them.
package httpcore

import "time"

// RequestSpec is the fully-resolved input to Execute.
type RequestSpec struct {
	Method        string
	URL           string
	Body          any
	Query         map[string]string
	Headers       map[string]string
	Retry         int
	RetryDelay    time.Duration
	Timeout       time.Duration
	RaiseOnStatus string
	IgnoreSSL     bool
}
