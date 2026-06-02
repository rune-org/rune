package outlook

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type SendEmail struct{}

type sendEmailArgs struct {
	To              string `json:"to"`
	CC              string `json:"cc"`
	BCC             string `json:"bcc"`
	Subject         string `json:"subject"`
	Body            string `json:"body"`
	SaveToSentItems bool   `json:"save_to_sent_items"`
}

func (SendEmail) Kind() string {
	return SendEmailKind
}

func (SendEmail) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args sendEmailArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.To == "" {
		return nil, errors.New("argument 'to' is required")
	}
	if args.Subject == "" {
		return nil, errors.New("argument 'subject' is required")
	}
	if args.Body == "" {
		return nil, errors.New("argument 'body' is required")
	}

	body := map[string]any{
		"message": map[string]any{
			"subject": args.Subject,
			"body": map[string]any{
				"contentType": "Text",
				"content":     args.Body,
			},
			"toRecipients": buildRecipients(args.To),
		},
	}

	if cc := buildRecipients(args.CC); len(cc) > 0 {
		body["message"].(map[string]any)["ccRecipients"] = cc
	}
	if bcc := buildRecipients(args.BCC); len(bcc) > 0 {
		body["message"].(map[string]any)["bccRecipients"] = bcc
	}

	body["saveToSentItems"] = args.SaveToSentItems
	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/v1.0/me/sendMail",
		Body:    body,
	})
}

func init() {
	integrations.Register(SendEmail{})
}
