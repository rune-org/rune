package telegram

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type SendMessage struct{}

type sendMessageArgs struct {
	ChatID              any    `json:"chat_id"`
	Text                string `json:"text"`
	ParseMode           string `json:"parse_mode"`
	DisableNotification bool   `json:"disable_notification"`
}

func (SendMessage) Kind() string {
	return SendMessageKind
}

func (SendMessage) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args sendMessageArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	chatID := chatIDToString(args.ChatID)
	if chatID == "" {
		return nil, errors.New("argument 'chat_id' is required")
	}
	if args.Text == "" {
		return nil, errors.New("argument 'text' is required")
	}

	token, err := botTokenFromCredentials(ec.GetCredentials())
	if err != nil {
		return nil, err
	}

	body := map[string]any{
		"chat_id": chatID,
		"text":    args.Text,
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
		Path:    "/bot{token}/sendMessage",
		PathArgs: map[string]string{
			"token": token,
		},
		RedactedPathKeys: []string{"token"},
		Body:             body,
	})
}

func init() {
	integrations.Register(SendMessage{})
}
