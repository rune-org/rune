package outlook

import (
	"context"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type ListFolders struct{}

func (ListFolders) Kind() string {
	return ListFoldersKind
}

func (ListFolders) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	return connector.Do(ctx, ec, connector.Spec{
		Method:  "GET",
		BaseURL: baseURL,
		Path:    "/v1.0/me/mailFolders",
	})
}

func init() {
	integrations.Register(ListFolders{})
}
