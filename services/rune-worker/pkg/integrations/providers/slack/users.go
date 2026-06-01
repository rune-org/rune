package slack

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type LookupByEmail struct{}

type lookupByEmailArgs struct {
	Email string `json:"email"`
}

func (LookupByEmail) Kind() string {
	return LookupByEmailKind
}

func (LookupByEmail) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args lookupByEmailArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.Email == "" {
		return nil, errors.New("argument 'email' is required")
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "GET",
		BaseURL: baseURL,
		Path:    "/api/users.lookupByEmail",
		Query: map[string]string{
			"email": args.Email,
		},
	})
}

func init() {
	integrations.Register(LookupByEmail{})
}
