package sheets

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type ReadRange struct{}

type readRangeArgs struct {
	SpreadsheetID string `json:"spreadsheet_id"`
	Range         string `json:"range"`
}

func (ReadRange) Kind() string {
	return ReadRangeKind
}

func (ReadRange) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args readRangeArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.SpreadsheetID == "" {
		return nil, errors.New("argument 'spreadsheet_id' is required")
	}
	if args.Range == "" {
		return nil, errors.New("argument 'range' is required")
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "GET",
		BaseURL: baseURL,
		Path:    "/v4/spreadsheets/{spreadsheetId}/values/{range}",
		PathArgs: map[string]string{
			"spreadsheetId": args.SpreadsheetID,
			"range":         args.Range,
		},
	})
}

func init() {
	integrations.Register(ReadRange{})
}
