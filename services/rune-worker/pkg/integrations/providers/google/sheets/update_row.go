package sheets

import (
	"context"
	"errors"
	"strings"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type UpdateRow struct{}

type updateRowArgs struct {
	SpreadsheetID    string `json:"spreadsheet_id"`
	SheetName        string `json:"sheet_name"`
	RowNumber        int    `json:"row_number"`
	StartColumn      string `json:"start_column"`
	ValueInputOption string `json:"value_input_option"`
	Values           []any  `json:"values"`
}

func (UpdateRow) Kind() string {
	return UpdateRowKind
}

func (UpdateRow) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args updateRowArgs
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
	if args.RowNumber <= 0 {
		return nil, errors.New("argument 'row_number' must be >= 1")
	}
	if args.StartColumn == "" {
		return nil, errors.New("argument 'start_column' is required")
	}

	rows, err := coerceRows(args.Values)
	if err != nil {
		return nil, err
	}
	if len(rows) != 1 {
		return nil, errors.New("values must contain exactly one row")
	}

	rangeValue, err := buildRowRange(args.SheetName, args.StartColumn, args.RowNumber, len(rows[0]))
	if err != nil {
		return nil, err
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "PUT",
		BaseURL: baseURL,
		Path:    "/v4/spreadsheets/{spreadsheetId}/values/{range}",
		PathArgs: map[string]string{
			"spreadsheetId": args.SpreadsheetID,
			"range":         rangeValue,
		},
		Query: optionalQuery("valueInputOption", args.ValueInputOption),
		Body: map[string]any{
			"range":  rangeValue,
			"values": rows,
		},
	})
}

func init() {
	integrations.Register(UpdateRow{})
}
