package sheets

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type DeleteSpreadsheet struct{}

type deleteSpreadsheetArgs struct {
	SpreadsheetID string `json:"spreadsheet_id"`
}

func (DeleteSpreadsheet) Kind() string {
	return DeleteSpreadsheetKind
}

func (DeleteSpreadsheet) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args deleteSpreadsheetArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.SpreadsheetID == "" {
		return nil, errors.New("argument 'spreadsheet_id' is required")
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "DELETE",
		BaseURL: driveBaseURL,
		Path:    "/drive/v3/files/{fileId}",
		PathArgs: map[string]string{
			"fileId": args.SpreadsheetID,
		},
		AllowNon2xx: false,
	})
}

func init() {
	integrations.Register(DeleteSpreadsheet{})
}
