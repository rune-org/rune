package sheets

import (
	"context"
	"errors"
	"strings"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type CreateSheet struct{}

type createSheetArgs struct {
	SpreadsheetID string `json:"spreadsheet_id"`
	Title         string `json:"title"`
	Rows          int    `json:"rows"`
	Columns       int    `json:"columns"`
}

func (CreateSheet) Kind() string {
	return CreateSheetKind
}

func (CreateSheet) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args createSheetArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	args.Title = strings.TrimSpace(args.Title)
	if args.SpreadsheetID == "" {
		return nil, errors.New("argument 'spreadsheet_id' is required")
	}
	if args.Title == "" {
		return nil, errors.New("argument 'title' is required")
	}

	properties := map[string]any{"title": args.Title}
	if args.Rows > 0 || args.Columns > 0 {
		grid := map[string]any{}
		if args.Rows > 0 {
			grid["rowCount"] = args.Rows
		}
		if args.Columns > 0 {
			grid["columnCount"] = args.Columns
		}
		properties["gridProperties"] = grid
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/v4/spreadsheets/{spreadsheetId}:batchUpdate",
		PathArgs: map[string]string{
			"spreadsheetId": args.SpreadsheetID,
		},
		Body: map[string]any{
			"requests": []any{
				map[string]any{
					"addSheet": map[string]any{
						"properties": properties,
					},
				},
			},
		},
	})
}

func init() {
	integrations.Register(CreateSheet{})
}
