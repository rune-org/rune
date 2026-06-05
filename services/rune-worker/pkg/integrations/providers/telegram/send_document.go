package telegram

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type SendDocument struct{}

type sendDocumentArgs struct {
	ChatID              any    `json:"chat_id"`
	Document            string `json:"document"`
	Caption             string `json:"caption"`
	ParseMode           string `json:"parse_mode"`
	DisableNotification bool   `json:"disable_notification"`
}

func (SendDocument) Kind() string {
	return SendDocumentKind
}

func (SendDocument) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args sendDocumentArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	chatID := chatIDToString(args.ChatID)
	if chatID == "" {
		return nil, errors.New("argument 'chat_id' is required")
	}
	if args.Document == "" {
		return nil, errors.New("argument 'document' is required")
	}

	token, err := botTokenFromCredentials(ec.GetCredentials())
	if err != nil {
		return nil, err
	}

	body := map[string]any{
		"chat_id":  chatID,
		"document": args.Document,
	}
	if args.Caption != "" {
		body["caption"] = args.Caption
	}
	if args.ParseMode != "" {
		body["parse_mode"] = args.ParseMode
	}
	if args.DisableNotification {
		body["disable_notification"] = true
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/bot{token}/sendDocument",
		PathArgs: map[string]string{
			"token": token,
		},
		Body: body,
	})
}

func init() {
	integrations.Register(SendDocument{})
}
