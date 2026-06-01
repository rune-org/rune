package slack

import (
	"context"
	"errors"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

// PostMessage

type PostMessage struct{}

type postMessageArgs struct {
	Channel string `json:"channel"`
	Text    string `json:"text"`
}

func (PostMessage) Kind() string {
	return PostMessageKind
}

func (PostMessage) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args postMessageArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.Channel == "" {
		return nil, errors.New("argument 'channel' is required")
	}
	if args.Text == "" {
		return nil, errors.New("argument 'text' is required")
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/api/chat.postMessage",
		Body: map[string]any{
			"channel": args.Channel,
			"text":    args.Text,
		},
	})
}

// UpdateMessage

type UpdateMessage struct{}

type updateMessageArgs struct {
	Channel string `json:"channel"`
	TS      string `json:"ts"`
	Text    string `json:"text"`
}

func (UpdateMessage) Kind() string {
	return UpdateMessageKind
}

func (UpdateMessage) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args updateMessageArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.Channel == "" {
		return nil, errors.New("argument 'channel' is required")
	}
	if args.TS == "" {
		return nil, errors.New("argument 'ts' is required")
	}
	if args.Text == "" {
		return nil, errors.New("argument 'text' is required")
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/api/chat.update",
		Body: map[string]any{
			"channel": args.Channel,
			"ts":      args.TS,
			"text":    args.Text,
		},
	})
}

// DeleteMessage

type DeleteMessage struct{}

type deleteMessageArgs struct {
	Channel string `json:"channel"`
	TS      string `json:"ts"`
}

func (DeleteMessage) Kind() string {
	return DeleteMessageKind
}

func (DeleteMessage) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args deleteMessageArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.Channel == "" {
		return nil, errors.New("argument 'channel' is required")
	}
	if args.TS == "" {
		return nil, errors.New("argument 'ts' is required")
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/api/chat.delete",
		Body: map[string]any{
			"channel": args.Channel,
			"ts":      args.TS,
		},
	})
}

func init() {
	integrations.Register(PostMessage{})
	integrations.Register(UpdateMessage{})
	integrations.Register(DeleteMessage{})
}
