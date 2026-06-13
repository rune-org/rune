package dropbox

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type GetTemporaryLink struct{}

type getTemporaryLinkArgs struct {
	Path string `json:"path"`
}

func (GetTemporaryLink) Kind() string {
	return GetTemporaryLinkKind
}

func (GetTemporaryLink) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args getTemporaryLinkArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.Path == "" {
		return nil, errors.New("argument 'path' is required")
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/2/files/get_temporary_link",
		Body: map[string]any{
			"path": args.Path,
		},
	})
}

func init() {
	integrations.Register(GetTemporaryLink{})
}
