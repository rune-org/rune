package dropbox

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type Search struct{}

type searchArgs struct {
	Query        string `json:"query"`
	Path         string `json:"path"`
	FilenameOnly bool   `json:"filename_only"`
}

func (Search) Kind() string {
	return SearchKind
}

func (Search) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args searchArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.Query == "" {
		return nil, errors.New("argument 'query' is required")
	}

	options := map[string]any{}
	if args.Path != "" {
		options["path"] = args.Path
	}
	if args.FilenameOnly {
		options["filename_only"] = true
	}

	body := map[string]any{
		"query": args.Query,
	}
	if len(options) > 0 {
		body["options"] = options
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/2/files/search_v2",
		Body:    body,
	})
}

func init() {
	integrations.Register(Search{})
}
