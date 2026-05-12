package sheets

import (
	"context"
	"errors"
	"strings"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type AppendRow struct{}

type appendRowArgs struct {
	SpreadsheetID    string `json:"spreadsheet_id"`
	SheetName        string `json:"sheet_name"`
	ValueInputOption string `json:"value_input_option"`
	Values           []any  `json:"values"`
}

func (AppendRow) Kind() string {
	return AppendRowKind
}

func (AppendRow) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args appendRowArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.SpreadsheetID == "" {
		return nil, errors.New("argument 'spreadsheet_id' is required")
	}
	args.SheetName = strings.TrimSpace(args.SheetName)
	if args.SheetName == "" {
		return nil, errors.New("argument 'sheet_name' is required")
	}
	if len(args.Values) == 0 {
		return nil, errors.New("argument 'values' is required")
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/v4/spreadsheets/{spreadsheetId}/values/{range}:append",
		PathArgs: map[string]string{
			"spreadsheetId": args.SpreadsheetID,
			"range":         args.SheetName,
		},
		Query: optionalQuery("valueInputOption", args.ValueInputOption),
		Body: map[string]any{
			"values": args.Values,
		},
	})
}

func init() {
	integrations.Register(AppendRow{})
}
