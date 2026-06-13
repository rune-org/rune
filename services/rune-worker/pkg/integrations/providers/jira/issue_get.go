package jira

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type IssueGet struct{}

type issueGetArgs struct {
	baseArgs
	IssueIDOrKey string `json:"issue_id_or_key"`
	Fields       string `json:"fields"`
	Expand       string `json:"expand"`
}

func (IssueGet) Kind() string {
	return IssueGetKind
}

func (IssueGet) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args issueGetArgs
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

	query := addQuery(nil, "fields", args.Fields)
	query = addQuery(query, "expand", args.Expand)

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "GET",
		BaseURL: baseURL,
		Path:    apiBasePath(version) + "/issue/{issueIdOrKey}",
		PathArgs: map[string]string{
			"issueIdOrKey": args.IssueIDOrKey,
		},
		Query: query,
	})
}

func init() {
	integrations.Register(IssueGet{})
}
