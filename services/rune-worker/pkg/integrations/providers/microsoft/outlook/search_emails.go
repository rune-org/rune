package outlook

import (
	"context"
	"strconv"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type SearchEmails struct{}

type searchEmailsArgs struct {
	Q                string `json:"q"`
	MaxResults       int    `json:"maxResults"`
	LabelIDs         string `json:"labelIds"`
	IncludeSpamTrash bool   `json:"includeSpamTrash"`
}

func (SearchEmails) Kind() string {
	return SearchEmailsKind
}

func (SearchEmails) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args searchEmailsArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	query := map[string]string{}
	if args.Q != "" {
		query["$search"] = `"` + args.Q + `"`
	}

	if args.MaxResults > 0 {
		query["$top"] = strconv.Itoa(args.MaxResults)
	}

	path := "/v1.0/me/messages"
	if args.LabelIDs != "" {
		path = "/v1.0/me/mailFolders/" + args.LabelIDs + "/messages"
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "GET",
		BaseURL: baseURL,
		Path:    path,
		Query:   query,
	})
}

func init() {
	integrations.Register(SearchEmails{})
}
