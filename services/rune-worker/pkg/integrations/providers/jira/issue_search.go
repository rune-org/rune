package jira

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type IssueSearch struct{}

type issueSearchArgs struct {
	baseArgs
	JQL           string `json:"jql"`
	StartAt       int    `json:"start_at"`
	MaxResults    int    `json:"max_results"`
	Fields        string `json:"fields"`
	Expand        string `json:"expand"`
	ValidateQuery *bool  `json:"validate_query"`
}

func (IssueSearch) Kind() string {
	return IssueSearchKind
}

func (IssueSearch) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args issueSearchArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.JQL == "" {
		return nil, errors.New("argument 'jql' is required")
	}
	baseURL, err := resolveBaseURL(ctx, args.baseArgs, ec)
	if err != nil {
		return nil, err
	}
	version, err := resolveAPIVersion(args.baseArgs)
	if err != nil {
		return nil, err
	}

	body := map[string]any{
		"jql": args.JQL,
	}
	if args.StartAt > 0 {
		body["startAt"] = args.StartAt
	}
	if args.MaxResults > 0 {
		body["maxResults"] = args.MaxResults
	}
	if args.Fields != "" {
		body["fields"] = splitCSV(args.Fields)
	}
	if args.Expand != "" {
		body["expand"] = splitCSV(args.Expand)
	}
	if args.ValidateQuery != nil {
		body["validateQuery"] = *args.ValidateQuery
	}

	path := apiBasePath(version) + "/search"
	if version == "3" {
		path = apiBasePath(version) + "/search/jql"
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    path,
		Body:    body,
	})
}

func init() {
	integrations.Register(IssueSearch{})
}
