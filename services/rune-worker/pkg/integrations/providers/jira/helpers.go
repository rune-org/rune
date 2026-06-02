package jira

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/url"
	"strconv"
	"strings"
	"sync"

	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type baseArgs struct {
	BaseURL    string `json:"base_url"`
	CloudID    string `json:"cloud_id"`
	APIVersion string `json:"api_version"`
}

type convenienceFields struct {
	ProjectKey        string `json:"project_key"`
	IssueType         string `json:"issue_type"`
	Summary           string `json:"summary"`
	Description       string `json:"description"`
	Labels            string `json:"labels"`
	Priority          string `json:"priority"`
	AssigneeAccountID string `json:"assignee_account_id"`
	ReporterAccountID string `json:"reporter_account_id"`
}

func buildIssueFields(c convenienceFields) map[string]any {
	fields := map[string]any{}
	if strings.TrimSpace(c.ProjectKey) != "" {
		fields["project"] = map[string]any{"key": strings.TrimSpace(c.ProjectKey)}
	}
	if strings.TrimSpace(c.IssueType) != "" {
		fields["issuetype"] = map[string]any{"name": strings.TrimSpace(c.IssueType)}
	}
	if strings.TrimSpace(c.Summary) != "" {
		fields["summary"] = strings.TrimSpace(c.Summary)
	}
	if strings.TrimSpace(c.Description) != "" {
		fields["description"] = plainTextToADF(strings.TrimSpace(c.Description))
	}
	if labels := splitCSV(c.Labels); len(labels) > 0 {
		fields["labels"] = labels
	}
	if strings.TrimSpace(c.Priority) != "" {
		fields["priority"] = map[string]any{"name": strings.TrimSpace(c.Priority)}
	}
	if strings.TrimSpace(c.AssigneeAccountID) != "" {
		fields["assignee"] = map[string]any{"accountId": strings.TrimSpace(c.AssigneeAccountID)}
	}
	if strings.TrimSpace(c.ReporterAccountID) != "" {
		fields["reporter"] = map[string]any{"accountId": strings.TrimSpace(c.ReporterAccountID)}
	}
	return fields
}

func plainTextToADF(text string) map[string]any {
	return map[string]any{
		"type":    "doc",
		"version": 1,
		"content": []any{
			map[string]any{
				"type": "paragraph",
				"content": []any{
					map[string]any{
						"type": "text",
						"text": text,
					},
				},
			},
		},
	}
}

func mergeFields(primary, fallback map[string]any) map[string]any {
	if len(primary) == 0 {
		return fallback
	}
	if len(fallback) == 0 {
		return primary
	}
	primaryLen := len(primary)
	fallbackLen := len(fallback)
	var merged map[string]any
	if primaryLen > math.MaxInt-fallbackLen {
		merged = make(map[string]any)
	} else {
		merged = make(map[string]any, primaryLen+fallbackLen)
	}
	for key, value := range fallback {
		merged[key] = value
	}
	for key, value := range primary {
		merged[key] = value
	}
	return merged
}

var cloudIDCache sync.Map

func resolveBaseURL(ctx context.Context, args baseArgs, ec plugin.ExecutionContext) (string, error) {
	baseURL := strings.TrimSpace(args.BaseURL)
	cloudID := strings.TrimSpace(args.CloudID)
	creds := ec.GetCredentials()
	params := ec.Parameters
	if baseURL == "" {
		baseURL = firstNonEmpty(
			stringFromParams(params, "base_url"),
			stringFromParams(params, "baseUrl"),
		)
	}
	if cloudID == "" {
		cloudID = firstNonEmpty(
			stringFromParams(params, "cloud_id"),
			stringFromParams(params, "cloudId"),
		)
	}

	if baseURL == "" {
		baseURL = firstNonEmpty(
			stringFromCreds(creds, "base_url"),
			stringFromCreds(creds, "site_url"),
			stringFromCreds(creds, "domain"),
		)
	}
	if cloudID == "" {
		cloudID = firstNonEmpty(
			stringFromCreds(creds, "cloud_id"),
			stringFromCreds(creds, "cloudId"),
		)
	}
	if cloudID == "" && isOAuth2Credential(creds) {
		siteURL := firstNonEmpty(
			stringFromCreds(creds, "site_url"),
			stringFromCreds(creds, "domain"),
		)
		if siteURL == "" && baseURL != "" {
			normalized, err := normalizeBaseURL(baseURL)
			if err == nil {
				parsed, err := url.Parse(normalized)
				if err == nil && parsed.Host != "api.atlassian.com" {
					siteURL = normalized
				}
			}
		}
		if siteURL != "" {
			resolvedCloudID, err := fetchCloudID(ctx, ec, siteURL)
			if err != nil {
				return "", err
			}
			cloudID = resolvedCloudID
			if baseURL == "" {
				baseURL = siteURL
			}
		}
	}
	if cloudID != "" {
		candidate := baseURL
		if candidate != "" {
			normalized, err := normalizeBaseURL(candidate)
			if err != nil {
				return "", err
			}
			candidate = normalized
		}
		adjusted, err := applyCloudIDBase(candidate, cloudID)
		if err != nil {
			return "", err
		}
		normalized, err := normalizeBaseURL(adjusted)
		if err != nil {
			return "", err
		}
		if missingCloudPath(normalized) {
			return "", fmt.Errorf("jira oauth base url must include /ex/jira/{cloudId}; got %q", normalized)
		}
		return normalized, nil
	}
	if baseURL == "" {
		return "", errors.New("argument 'base_url' is required")
	}

	normalized, err := normalizeBaseURL(baseURL)
	if err != nil {
		return "", err
	}
	if missingCloudPath(normalized) {
		return "", fmt.Errorf("jira oauth base url must include /ex/jira/{cloudId}; got %q", normalized)
	}
	return normalized, nil
}

func resolveAPIVersion(args baseArgs) (string, error) {
	v := strings.TrimSpace(args.APIVersion)
	if v == "" {
		return "3", nil
	}
	v = strings.TrimPrefix(strings.ToLower(v), "v")
	if v != "2" && v != "3" {
		return "", fmt.Errorf("unsupported api_version %q", args.APIVersion)
	}
	return v, nil
}

func apiBasePath(version string) string {
	return "rest/api/" + version
}

func optionalQuery(key, value string) map[string]string {
	if strings.TrimSpace(value) == "" {
		return map[string]string{}
	}
	return map[string]string{key: value}
}

func addQuery(query map[string]string, key, value string) map[string]string {
	if strings.TrimSpace(value) == "" {
		return query
	}
	if query == nil {
		query = map[string]string{}
	}
	query[key] = value
	return query
}

func addQueryBool(query map[string]string, key string, value *bool) map[string]string {
	if value == nil {
		return query
	}
	if query == nil {
		query = map[string]string{}
	}
	query[key] = strconv.FormatBool(*value)
	return query
}

func addQueryInt(query map[string]string, key string, value int) map[string]string {
	if value <= 0 {
		return query
	}
	if query == nil {
		query = map[string]string{}
	}
	query[key] = strconv.Itoa(value)
	return query
}

func joinCSV(values []string) string {
	if len(values) == 0 {
		return ""
	}
	out := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return strings.Join(out, ",")
}

func splitCSV(value string) []string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	parts := strings.Split(trimmed, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item != "" {
			out = append(out, item)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func normalizeBaseURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", errors.New("base url is required")
	}
	if !strings.Contains(trimmed, "://") {
		trimmed = "https://" + trimmed
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "", fmt.Errorf("invalid base url: %w", err)
	}
	if parsed.Host == "" {
		return "", errors.New("base url must include host")
	}
	return strings.TrimRight(parsed.String(), "/"), nil
}

func applyCloudIDBase(baseURL string, cloudID string) (string, error) {
	if strings.TrimSpace(cloudID) == "" {
		return baseURL, nil
	}
	if strings.TrimSpace(baseURL) == "" {
		return fmt.Sprintf("https://api.atlassian.com/ex/jira/%s", cloudID), nil
	}
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return "", fmt.Errorf("invalid base url: %w", err)
	}
	if parsed.Host != "api.atlassian.com" {
		return fmt.Sprintf("https://api.atlassian.com/ex/jira/%s", cloudID), nil
	}
	path := strings.TrimSuffix(parsed.Path, "/")
	if strings.HasPrefix(path, "/ex/jira/") {
		return baseURL, nil
	}
	parsed.Path = "/ex/jira/" + cloudID
	parsed.RawQuery = ""
	return strings.TrimRight(parsed.String(), "/"), nil
}

func fetchCloudID(ctx context.Context, ec plugin.ExecutionContext, siteURL string) (string, error) {
	normalizedSite, err := normalizeBaseURL(siteURL)
	if err != nil {
		return "", err
	}
	if cached, ok := cloudIDCache.Load(normalizedSite); ok {
		if value, ok := cached.(string); ok && value != "" {
			return value, nil
		}
	}

	raw, err := connector.Do(ctx, ec, connector.Spec{
		Method:      "GET",
		BaseURL:     "https://api.atlassian.com",
		Path:        "/oauth/token/accessible-resources",
		AllowNon2xx: true,
	})
	if err != nil {
		return "", err
	}
	status, _ := raw["status"].(int)
	if status < 200 || status >= 300 {
		return "", fmt.Errorf("failed to fetch accessible resources: status=%d", status)
	}

	cloudID, err := matchAccessibleResource(raw["body"], normalizedSite)
	if err != nil {
		return "", err
	}
	cloudIDCache.Store(normalizedSite, cloudID)
	return cloudID, nil
}

func matchAccessibleResource(body any, normalizedSite string) (string, error) {
	resources, ok := body.([]any)
	if !ok {
		return "", errors.New("unexpected accessible resources response")
	}
	for _, item := range resources {
		resource, ok := item.(map[string]any)
		if !ok {
			continue
		}
		resourceURL, _ := resource["url"].(string)
		resourceID, _ := resource["id"].(string)
		if resourceURL == "" || resourceID == "" {
			continue
		}
		normalizedResource, err := normalizeBaseURL(resourceURL)
		if err != nil {
			continue
		}
		if normalizedResource == normalizedSite {
			return resourceID, nil
		}
	}
	return "", fmt.Errorf("no accessible Jira site found for domain: %s", normalizedSite)
}

func isOAuth2Credential(creds map[string]any) bool {
	credType, _ := creds["type"].(string)
	return credType == "oauth2"
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func stringFromCreds(creds map[string]any, key string) string {
	if len(creds) == 0 {
		return ""
	}
	if values, ok := creds["values"].(map[string]any); ok {
		if v, ok := values[key].(string); ok {
			return strings.TrimSpace(v)
		}
	}
	if v, ok := creds[key].(string); ok {
		return strings.TrimSpace(v)
	}
	return ""
}

func stringFromParams(params map[string]any, key string) string {
	if len(params) == 0 {
		return ""
	}
	if v, ok := params[key].(string); ok {
		return strings.TrimSpace(v)
	}
	if nested, ok := params["arguments"].(map[string]any); ok {
		if v, ok := nested[key].(string); ok {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func missingCloudPath(baseURL string) bool {
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return false
	}
	if parsed.Host != "api.atlassian.com" {
		return false
	}
	return !strings.HasPrefix(parsed.Path, "/ex/jira/")
}
