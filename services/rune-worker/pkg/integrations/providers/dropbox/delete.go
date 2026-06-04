package dropbox

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type Delete struct{}

type deleteArgs struct {
	Path string `json:"path"`
}

func (Delete) Kind() string {
	return DeleteKind
}

func (Delete) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args deleteArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.Path == "" {
		return nil, errors.New("argument 'path' is required")
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/2/files/delete_v2",
		Body: map[string]any{
			"path": args.Path,
		},
	})
}

func init() {
	integrations.Register(Delete{})
}
