package sheets

import (
	"context"
	"errors"
	"strings"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type DeleteSheet struct{}

type deleteSheetArgs struct {
	SpreadsheetID string `json:"spreadsheet_id"`
	SheetName     string `json:"sheet_name"`
}

func (DeleteSheet) Kind() string {
	return DeleteSheetKind
}

func (DeleteSheet) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args deleteSheetArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	args.SheetName = strings.TrimSpace(args.SheetName)
	if args.SpreadsheetID == "" {
		return nil, errors.New("argument 'spreadsheet_id' is required")
	}
	if args.SheetName == "" {
		return nil, errors.New("argument 'sheet_name' is required")
	}

	sheetID, err := resolveSheetID(ctx, ec, args.SpreadsheetID, args.SheetName)
	if err != nil {
		return nil, err
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
					"deleteSheet": map[string]any{
						"sheetId": sheetID,
					},
				},
			},
		},
	})
}

func init() {
	integrations.Register(DeleteSheet{})
}
