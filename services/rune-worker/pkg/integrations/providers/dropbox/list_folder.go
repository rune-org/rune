package dropbox

import (
	"context"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type ListFolder struct{}

type listFolderArgs struct {
	Path      string `json:"path"`
	Recursive bool   `json:"recursive"`
	Limit     int    `json:"limit"`
}

func (ListFolder) Kind() string {
	return ListFolderKind
}

func (ListFolder) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args listFolderArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}

	body := map[string]any{
		"path":      args.Path,
		"recursive": args.Recursive,
	}
	if args.Limit > 0 {
		body["limit"] = args.Limit
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/2/files/list_folder",
		Body:    body,
	})
}

func init() {
	integrations.Register(ListFolder{})
}
