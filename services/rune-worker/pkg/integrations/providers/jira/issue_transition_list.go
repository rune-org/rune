package jira

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type IssueTransitionList struct{}

type issueTransitionListArgs struct {
	baseArgs
	IssueIDOrKey string `json:"issue_id_or_key"`
	Expand       string `json:"expand"`
}

func (IssueTransitionList) Kind() string {
	return IssueTransitionListKind
}

func (IssueTransitionList) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args issueTransitionListArgs
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

	query := addQuery(nil, "expand", args.Expand)

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "GET",
		BaseURL: baseURL,
		Path:    apiBasePath(version) + "/issue/{issueIdOrKey}/transitions",
		PathArgs: map[string]string{
			"issueIdOrKey": args.IssueIDOrKey,
		},
		Query: query,
	})
}

func init() {
	integrations.Register(IssueTransitionList{})
}
