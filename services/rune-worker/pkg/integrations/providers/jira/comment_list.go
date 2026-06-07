package jira

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type CommentList struct{}

type commentListArgs struct {
	baseArgs
	IssueIDOrKey string `json:"issue_id_or_key"`
	StartAt      int    `json:"start_at"`
	MaxResults   int    `json:"max_results"`
	OrderBy      string `json:"order_by"`
	Expand       string `json:"expand"`
}

func (CommentList) Kind() string {
	return CommentListKind
}

func (CommentList) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args commentListArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.IssueIDOrKey == "" {
		return nil, errors.New("argument 'issue_id_or_key' is required")
	}
	baseURL, err := resolveBaseURL(ctx, args.baseArgs, ec)
	if err != nil {
		return nil, err
	}
	version, err := resolveAPIVersion(args.baseArgs)
	if err != nil {
		return nil, err
	}

	query := addQueryInt(nil, "startAt", args.StartAt)
	query = addQueryInt(query, "maxResults", args.MaxResults)
	query = addQuery(query, "orderBy", args.OrderBy)
	query = addQuery(query, "expand", args.Expand)

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "GET",
		BaseURL: baseURL,
		Path:    apiBasePath(version) + "/issue/{issueIdOrKey}/comment",
		PathArgs: map[string]string{
			"issueIdOrKey": args.IssueIDOrKey,
		},
		Query: query,
	})
}

func init() {
	integrations.Register(CommentList{})
}
