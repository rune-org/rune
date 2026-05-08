package gmail

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type SendEmail struct{}

type sendEmailArgs struct {
	To      string `json:"to"`
	CC      string `json:"cc"`
	BCC     string `json:"bcc"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
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

	raw, err := buildRawMessage(args)
	if err != nil {
		return nil, err
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/gmail/v1/users/me/messages/send",
		Body: map[string]any{
			"raw": raw,
		},
	})
}

func buildRawMessage(args sendEmailArgs) (string, error) {
	var lines []string
	lines = append(lines, fmt.Sprintf("To: %s", sanitizeHeaderValue(args.To)))

	if cc := sanitizeHeaderValue(args.CC); cc != "" {
		lines = append(lines, fmt.Sprintf("Cc: %s", cc))
	}
	if bcc := sanitizeHeaderValue(args.BCC); bcc != "" {
		lines = append(lines, fmt.Sprintf("Bcc: %s", bcc))
	}

	lines = append(lines,
		fmt.Sprintf("Subject: %s", sanitizeHeaderValue(args.Subject)),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		args.Body,
	)

	message := strings.Join(lines, "\r\n")
	return base64.RawURLEncoding.EncodeToString([]byte(message)), nil
}

func sanitizeHeaderValue(v string) string {
	v = strings.ReplaceAll(v, "\r", " ")
	return strings.ReplaceAll(v, "\n", " ")
}

func init() {
	integrations.Register(SendEmail{})
}
