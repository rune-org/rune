package outlook

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type ReadEmail struct{}

type readEmailArgs struct {
	ID     string `json:"id"`
	Select string `json:"select"`
}

func (ReadEmail) Kind() string {
	return ReadEmailKind
}

func (ReadEmail) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args readEmailArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.ID == "" {
		return nil, errors.New("argument 'id' is required")
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:   "GET",
		BaseURL:  baseURL,
		Path:     "/v1.0/me/messages/{id}",
		PathArgs: map[string]string{"id": args.ID},
		Query:    optionalQuery("$select", args.Select),
	})
}

func init() {
	integrations.Register(ReadEmail{})
}
