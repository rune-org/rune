package sheets

import (
	"context"
	"errors"
	"strings"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type DeleteColumns struct{}

type deleteColumnsArgs struct {
	SpreadsheetID string `json:"spreadsheet_id"`
	SheetName     string `json:"sheet_name"`
	StartColumn   string `json:"start_column"`
	ColumnCount   int    `json:"column_count"`
}

func (DeleteColumns) Kind() string {
	return DeleteColumnsKind
}

func (DeleteColumns) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args deleteColumnsArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	args.SheetName = strings.TrimSpace(args.SheetName)
	args.StartColumn = strings.TrimSpace(args.StartColumn)
	if args.SpreadsheetID == "" {
		return nil, errors.New("argument 'spreadsheet_id' is required")
	}
	if args.SheetName == "" {
		return nil, errors.New("argument 'sheet_name' is required")
	}
	if args.StartColumn == "" {
		return nil, errors.New("argument 'start_column' is required")
	}
	if args.ColumnCount <= 0 {
		return nil, errors.New("argument 'column_count' must be >= 1")
	}

	sheetID, err := resolveSheetID(ctx, ec, args.SpreadsheetID, args.SheetName)
	if err != nil {
		return nil, err
	}

	startIndex, err := columnIndex(args.StartColumn)
	if err != nil {
		return nil, err
	}
	startIndex--
	endIndex := startIndex + args.ColumnCount

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
							"dimension": "COLUMNS",
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
	integrations.Register(DeleteColumns{})
}
