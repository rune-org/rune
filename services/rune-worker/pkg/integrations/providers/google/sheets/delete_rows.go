package sheets

import (
	"context"
	"errors"
	"strings"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type DeleteRows struct{}

type deleteRowsArgs struct {
	SpreadsheetID string `json:"spreadsheet_id"`
	SheetName     string `json:"sheet_name"`
	StartRow      int    `json:"start_row"`
	RowCount      int    `json:"row_count"`
}

func (DeleteRows) Kind() string {
	return DeleteRowsKind
}

func (DeleteRows) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args deleteRowsArgs
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
	if args.StartRow <= 0 {
		return nil, errors.New("argument 'start_row' must be >= 1")
	}
	if args.RowCount <= 0 {
		return nil, errors.New("argument 'row_count' must be >= 1")
	}

	sheetID, err := resolveSheetID(ctx, ec, args.SpreadsheetID, args.SheetName)
	if err != nil {
		return nil, err
	}

	startIndex := args.StartRow - 1
	endIndex := startIndex + args.RowCount

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
					"deleteDimension": map[string]any{
						"range": map[string]any{
							"sheetId":    sheetID,
							"dimension": "ROWS",
							"startIndex": startIndex,
							"endIndex":   endIndex,
						},
					},
				},
			},
		},
	})
}

func init() {
	integrations.Register(DeleteRows{})
}
