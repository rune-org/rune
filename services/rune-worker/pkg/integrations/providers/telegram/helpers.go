package telegram

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

func botTokenFromCredentials(creds map[string]any) (string, error) {
	if len(creds) == 0 {
		return "", errors.New("telegram credentials are required")
	}
	values := creds
	if v, ok := creds["values"].(map[string]any); ok {
		values = v
	}
	if token, ok := values["token"].(string); ok && token != "" {
		return token, nil
	}
	if token, ok := values["access_token"].(string); ok && token != "" {
		return token, nil
	}
	if token, ok := values["value"].(string); ok && token != "" {
		return token, nil
	}
	return "", errors.New("telegram bot token is required")
}

func chatIDToString(v any) string {
	switch val := v.(type) {
	case float64:
		return strconv.FormatInt(int64(val), 10)
	case int64:
		return strconv.FormatInt(val, 10)
	case string:
		return val
	default:
		return fmt.Sprint(v)
	}
}

func splitCSV(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
