package sheets

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type WriteRange struct{}

type writeRangeArgs struct {
	SpreadsheetID    string `json:"spreadsheet_id"`
	Range            string `json:"range"`
	ValueInputOption string `json:"value_input_option"`
	Values           []any  `json:"values"`
}

func (WriteRange) Kind() string {
	return WriteRangeKind
}

func (WriteRange) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args writeRangeArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.SpreadsheetID == "" {
		return nil, errors.New("argument 'spreadsheet_id' is required")
	}
	if args.Range == "" {
		return nil, errors.New("argument 'range' is required")
	}
	if len(args.Values) == 0 {
		return nil, errors.New("argument 'values' is required")
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "PUT",
		BaseURL: baseURL,
		Path:    "/v4/spreadsheets/{spreadsheetId}/values/{range}",
		PathArgs: map[string]string{
			"spreadsheetId": args.SpreadsheetID,
			"range":         args.Range,
		},
		Query: optionalQuery("valueInputOption", args.ValueInputOption),
		Body: map[string]any{
			"range":  args.Range,
			"values": args.Values,
		},
	})
}

func init() {
	integrations.Register(WriteRange{})
}
