package jira

import (
	"context"
	"errors"
	"strings"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type CommentCreate struct{}

type commentCreateArgs struct {
	baseArgs
	IssueIDOrKey string `json:"issue_id_or_key"`
	Body         any    `json:"body"`
	TextBody     string `json:"text_body"`
}

func (CommentCreate) Kind() string {
	return CommentCreateKind
}

func (CommentCreate) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args commentCreateArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.IssueIDOrKey == "" {
		return nil, errors.New("argument 'issue_id_or_key' is required")
	}
	bodyContent := args.Body
	if bodyContent == nil {
		if strings.TrimSpace(args.TextBody) == "" {
			return nil, errors.New("argument 'body' or 'text_body' is required")
		}
		bodyContent = plainTextToADF(strings.TrimSpace(args.TextBody))
	}
	baseURL, err := resolveBaseURL(ctx, args.baseArgs, ec)
	if err != nil {
		return nil, err
	}
	version, err := resolveAPIVersion(args.baseArgs)
	if err != nil {
		return nil, err
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    apiBasePath(version) + "/issue/{issueIdOrKey}/comment",
		PathArgs: map[string]string{
			"issueIdOrKey": args.IssueIDOrKey,
		},
		Body: map[string]any{
			"body": bodyContent,
		},
	})
}

func init() {
	integrations.Register(CommentCreate{})
}
