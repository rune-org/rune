package jira

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type IssueTransitionApply struct{}

type issueTransitionApplyArgs struct {
	baseArgs
	IssueIDOrKey   string         `json:"issue_id_or_key"`
	TransitionID   string         `json:"transition_id"`
	Fields         map[string]any `json:"fields"`
	Update         map[string]any `json:"update"`
	TransitionData map[string]any `json:"transition"`
}

func (IssueTransitionApply) Kind() string {
	return IssueTransitionApplyKind
}

func (IssueTransitionApply) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args issueTransitionApplyArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.IssueIDOrKey == "" {
		return nil, errors.New("argument 'issue_id_or_key' is required")
	}
	if args.TransitionID == "" && len(args.TransitionData) == 0 {
		return nil, errors.New("argument 'transition_id' or 'transition' is required")
	}
	baseURL, err := resolveBaseURL(ctx, args.baseArgs, ec)
	if err != nil {
		return nil, err
	}
	version, err := resolveAPIVersion(args.baseArgs)
	if err != nil {
		return nil, err
	}

	transition := map[string]any{}
	if args.TransitionID != "" {
		transition["id"] = args.TransitionID
	}
	for k, v := range args.TransitionData {
		transition[k] = v
	}

	body := map[string]any{
		"transition": transition,
	}
	if len(args.Fields) > 0 {
		body["fields"] = args.Fields
	}
	if len(args.Update) > 0 {
		body["update"] = args.Update
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    apiBasePath(version) + "/issue/{issueIdOrKey}/transitions",
		PathArgs: map[string]string{
			"issueIdOrKey": args.IssueIDOrKey,
		},
		Body: body,
	})
}

func init() {
	integrations.Register(IssueTransitionApply{})
}
