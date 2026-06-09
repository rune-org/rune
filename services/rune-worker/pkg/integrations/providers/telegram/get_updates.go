package telegram

import (
	"context"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type GetUpdates struct{}

type getUpdatesArgs struct {
	Offset         int    `json:"offset"`
	Limit          int    `json:"limit"`
	Timeout        int    `json:"timeout"`
	AllowedUpdates string `json:"allowed_updates"`
}

func (GetUpdates) Kind() string {
	return GetUpdatesKind
}

func (GetUpdates) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args getUpdatesArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}

	token, err := botTokenFromCredentials(ec.GetCredentials())
	if err != nil {
		return nil, err
	}

	body := map[string]any{}
	if args.Offset != 0 {
		body["offset"] = args.Offset
	}
	if args.Limit > 0 {
		body["limit"] = args.Limit
	}
	if args.Timeout > 0 {
		body["timeout"] = args.Timeout
	}
	if updates := splitCSV(args.AllowedUpdates); len(updates) > 0 {
		body["allowed_updates"] = updates
	}
	if len(body) == 0 {
		body = nil
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/bot{token}/getUpdates",
		PathArgs: map[string]string{
			"token": token,
		},
		RedactedPathKeys: []string{"token"},
		Body:             body,
	})
}

func init() {
	integrations.Register(GetUpdates{})
}
