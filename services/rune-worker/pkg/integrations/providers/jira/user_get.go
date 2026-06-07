package jira

import (
	"context"
	"errors"
	"strings"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type UserGet struct{}

type userGetArgs struct {
	baseArgs
	AccountID string `json:"account_id"`
	Username  string `json:"username"`
	UserKey   string `json:"user_key"`
	Query     string `json:"query"`
}

func (UserGet) Kind() string {
	return UserGetKind
}

func (UserGet) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args userGetArgs
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

	reqQuery := map[string]string{}
	var path string

	if strings.TrimSpace(args.Query) != "" {
		path = apiBasePath(version) + "/user/search"
		reqQuery["query"] = strings.TrimSpace(args.Query)
	} else if args.AccountID != "" {
		path = apiBasePath(version) + "/user"
		reqQuery["accountId"] = args.AccountID
	} else if version == "2" && args.Username != "" {
		path = apiBasePath(version) + "/user"
		reqQuery["username"] = args.Username
	} else if version == "2" && args.UserKey != "" {
		path = apiBasePath(version) + "/user"
		reqQuery["key"] = args.UserKey
	} else {
		return nil, errors.New("provide a 'query' (name/email) to search, or an 'account_id' (v3) / 'username' (v2) for exact lookup")
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "GET",
		BaseURL: baseURL,
		Path:    path,
		Query:   reqQuery,
	})
}

func init() {
	integrations.Register(UserGet{})
}
