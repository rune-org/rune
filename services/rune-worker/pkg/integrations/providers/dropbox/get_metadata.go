package dropbox

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type GetMetadata struct{}

type getMetadataArgs struct {
	Path string `json:"path"`
}

func (GetMetadata) Kind() string {
	return GetMetadataKind
}

func (GetMetadata) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args getMetadataArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.Path == "" {
		return nil, errors.New("argument 'path' is required")
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/2/files/get_metadata",
		Body: map[string]any{
			"path": args.Path,
		},
	})
}

func init() {
	integrations.Register(GetMetadata{})
}
