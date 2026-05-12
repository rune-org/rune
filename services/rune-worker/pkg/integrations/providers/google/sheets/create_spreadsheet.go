package sheets

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type CreateSpreadsheet struct{}

type createSpreadsheetArgs struct {
	Title string `json:"title"`
}

func (CreateSpreadsheet) Kind() string {
	return CreateSpreadsheetKind
}

func (CreateSpreadsheet) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args createSpreadsheetArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.Title == "" {
		return nil, errors.New("argument 'title' is required")
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/v4/spreadsheets",
		Body: map[string]any{
			"properties": map[string]any{
				"title": args.Title,
			},
		},
	})
}

func init() {
	integrations.Register(CreateSpreadsheet{})
}
