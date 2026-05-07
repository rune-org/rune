package gmail

import (
	"context"
	"errors"
	"strconv"
	"strings"

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
	if args.Q == "" {
		return nil, errors.New("argument 'q' is required")
	}

	query := map[string]string{
		"q": args.Q,
	}
	if args.MaxResults > 0 {
		query["maxResults"] = strconv.Itoa(args.MaxResults)
	}
	if labels := splitCSV(args.LabelIDs); len(labels) > 0 {
		query["labelIds"] = strings.Join(labels, ",")
	}
	if args.IncludeSpamTrash {
		query["includeSpamTrash"] = "true"
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "GET",
		BaseURL: baseURL,
		Path:    "/gmail/v1/users/me/messages",
		Query:   query,
	})
}

func init() {
	integrations.Register(SearchEmails{})
}
