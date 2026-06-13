package jira

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type IssueCreate struct{}

type issueCreateArgs struct {
	baseArgs
	Fields map[string]any `json:"fields"`
	Update map[string]any `json:"update"`
	convenienceFields
}

func (IssueCreate) Kind() string {
	return IssueCreateKind
}

func (IssueCreate) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args issueCreateArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	baseURL, err := resolveBaseURL(ctx, args.baseArgs, ec)
	if err != nil {
		return nil, err
	}
	version, err := resolveAPIVersion(args.baseArgs)
	if err != nil {
		return nil, err
	}

	fields := mergeFields(args.Fields, buildIssueFields(args.convenienceFields))
	if len(fields) == 0 {
		return nil, errors.New("argument 'fields' is required")
	}
	if fields["project"] == nil || fields["issuetype"] == nil || fields["summary"] == nil {
		return nil, errors.New("arguments 'project_key', 'issue_type', and 'summary' are required when fields are not provided")
	}

	body := map[string]any{
		"fields": fields,
	}
	if len(args.Update) > 0 {
		body["update"] = args.Update
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    apiBasePath(version) + "/issue",
		Body:    body,
	})
}

func init() {
	integrations.Register(IssueCreate{})
}
