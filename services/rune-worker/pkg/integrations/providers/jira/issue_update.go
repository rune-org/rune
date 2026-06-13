package jira

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type IssueUpdate struct{}

type issueUpdateArgs struct {
	baseArgs
	IssueIDOrKey string         `json:"issue_id_or_key"`
	Fields       map[string]any `json:"fields"`
	Update       map[string]any `json:"update"`
	NotifyUsers  *bool          `json:"notify_users"`
	convenienceFields
}

func (IssueUpdate) Kind() string {
	return IssueUpdateKind
}

func (IssueUpdate) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args issueUpdateArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.IssueIDOrKey == "" {
		return nil, errors.New("argument 'issue_id_or_key' is required")
	}

	convenienceMap := buildIssueFields(args.convenienceFields)
	if len(args.Fields) == 0 && len(convenienceMap) > 0 {
		args.Fields = convenienceMap
	} else if len(args.Fields) > 0 && len(convenienceMap) > 0 {
		args.Fields = mergeFields(args.Fields, convenienceMap)
	}

	if len(args.Fields) == 0 && len(args.Update) == 0 {
		return nil, errors.New("argument 'fields' or 'update' is required")
	}
	baseURL, err := resolveBaseURL(ctx, args.baseArgs, ec)
	if err != nil {
		return nil, err
	}
	version, err := resolveAPIVersion(args.baseArgs)
	if err != nil {
		return nil, err
	}

	body := map[string]any{}
	if len(args.Fields) > 0 {
		body["fields"] = args.Fields
	}
	if len(args.Update) > 0 {
		body["update"] = args.Update
	}

	query := addQueryBool(nil, "notifyUsers", args.NotifyUsers)

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "PUT",
		BaseURL: baseURL,
		Path:    apiBasePath(version) + "/issue/{issueIdOrKey}",
		PathArgs: map[string]string{
			"issueIdOrKey": args.IssueIDOrKey,
		},
		Query: query,
		Body:  body,
	})
}

func init() {
	integrations.Register(IssueUpdate{})
}
