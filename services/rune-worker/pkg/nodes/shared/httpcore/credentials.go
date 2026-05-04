package httpcore

import (
	"encoding/base64"
	"strings"
)

// ApplyCredential injects a resolved credential into the request headers.
// Mirrors the auth handling from the http node; callers (http node, agent
// http_request tool) share this so auth logic stays consistent.
//
// Recognized credential types (the master embeds the values map):
//   - "basic_auth":      {"username": "...", "password": "..."}    -> Authorization: Basic <b64>
//   - "header":          {"field": "X-Foo", "value": "bar"}        -> X-Foo: bar
//   - "token":           {"token": "..."}                          -> Authorization: Bearer <token>
//   - "oauth2":          {"access_token": "...", "token_type": "..."} -> Authorization: <type> <token>
//   - "api_key":         {"key": "X-API-Key", "value": "..."} OR   -> X-API-Key: <value>
//     {"value": "..."}                          -> Authorization: Bearer <value>
//
// Existing headers are not overwritten — explicit user-provided values win.
func ApplyCredential(headers map[string]string, cred map[string]any) {
	if len(cred) == 0 || headers == nil {
		return
	}

	credType, _ := cred["type"].(string)
	values := credValues(cred)

	switch credType {
	case "basic_auth":
		if _, exists := headers["Authorization"]; exists {
			return
		}
		username, _ := values["username"].(string)
		password, _ := values["password"].(string)
		if username == "" || password == "" {
			return
		}
		raw := username + ":" + password
		headers["Authorization"] = "Basic " + base64.StdEncoding.EncodeToString([]byte(raw))

	case "header":
		field, _ := values["field"].(string)
		value, _ := values["value"].(string)
		if field == "" || value == "" {
			return
		}
		if _, exists := headers[field]; exists {
			return
		}
		headers[field] = value

	case "token":
		if _, exists := headers["Authorization"]; exists {
			return
		}
		token, _ := values["token"].(string)
		if token == "" {
			return
		}
		headers["Authorization"] = "Bearer " + token

	case "oauth2":
		if _, exists := headers["Authorization"]; exists {
			return
		}
		token, _ := values["access_token"].(string)
		if token == "" {
			return
		}
		tokenType, _ := values["token_type"].(string)
		if strings.EqualFold(tokenType, "bearer") || tokenType == "" {
			headers["Authorization"] = "Bearer " + token
			return
		}
		headers["Authorization"] = tokenType + " " + token

	case "api_key":
		field, _ := values["key"].(string)
		value, _ := values["value"].(string)
		if value == "" {
			return
		}
		if field != "" {
			if _, exists := headers[field]; exists {
				return
			}
			headers[field] = value
			return
		}
		if _, exists := headers["Authorization"]; exists {
			return
		}
		headers["Authorization"] = "Bearer " + value
	}
}

// credValues unwraps the master-resolved {"values": {...}} block, falling
// back to the cred map itself for callers that pass a flat shape.
func credValues(cred map[string]any) map[string]any {
	if v, ok := cred["values"].(map[string]any); ok {
		return v
	}
	return cred
}
