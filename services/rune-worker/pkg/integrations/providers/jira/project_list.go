package jira

import (
	"context"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type ProjectList struct{}

type projectListArgs struct {
	baseArgs
	StartAt    int `json:"start_at"`
	MaxResults int `json:"max_results"`
}

func (ProjectList) Kind() string {
	return ProjectListKind
}

func (ProjectList) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args projectListArgs
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

	path := apiBasePath(version) + "/project/search"
	query := addQueryInt(nil, "startAt", args.StartAt)
	query = addQueryInt(query, "maxResults", args.MaxResults)
	if version == "2" {
		path = apiBasePath(version) + "/project"
		query = nil
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "GET",
		BaseURL: baseURL,
		Path:    path,
		Query:   query,
	})
}

func init() {
	integrations.Register(ProjectList{})
}
