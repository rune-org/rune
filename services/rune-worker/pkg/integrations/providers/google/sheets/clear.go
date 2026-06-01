package sheets

import (
	"context"
	"errors"
	"strings"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type ClearSheet struct{}

type clearSheetArgs struct {
	SpreadsheetID string `json:"spreadsheet_id"`
	SheetName     string `json:"sheet_name"`
	Range         string `json:"range"`
}

func (ClearSheet) Kind() string {
	return ClearSheetKind
}

func (ClearSheet) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args clearSheetArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	args.SheetName = strings.TrimSpace(args.SheetName)
	args.Range = strings.TrimSpace(args.Range)
	if args.SpreadsheetID == "" {
		return nil, errors.New("argument 'spreadsheet_id' is required")
	}
	if args.SheetName == "" {
		return nil, errors.New("argument 'sheet_name' is required")
	}

	rangeValue := args.Range
	if rangeValue == "" {
		rangeValue = args.SheetName
	} else if !strings.Contains(rangeValue, "!") {
		rangeValue = args.SheetName + "!" + rangeValue
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/v4/spreadsheets/{spreadsheetId}/values/{range}:clear",
		PathArgs: map[string]string{
			"spreadsheetId": args.SpreadsheetID,
			"range":         rangeValue,
		},
	})
}

func init() {
	integrations.Register(ClearSheet{})
}
