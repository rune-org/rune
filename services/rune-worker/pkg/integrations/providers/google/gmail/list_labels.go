package gmail

import (
	"context"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type ListLabels struct{}

func (ListLabels) Kind() string {
	return ListLabelsKind
}

func (ListLabels) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	return connector.Do(ctx, ec, connector.Spec{
		Method:  "GET",
		BaseURL: baseURL,
		Path:    "/gmail/v1/users/me/labels",
	})
}

func init() {
	integrations.Register(ListLabels{})
}
