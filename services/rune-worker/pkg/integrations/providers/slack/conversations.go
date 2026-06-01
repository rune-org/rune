package slack

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type ConversationsHistory struct{}

type conversationsHistoryArgs struct {
	Channel string `json:"channel"`
	Limit   int    `json:"limit"`
}

func (ConversationsHistory) Kind() string {
	return ConversationsHistoryKind
}

func (ConversationsHistory) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args conversationsHistoryArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.Channel == "" {
		return nil, errors.New("argument 'channel' is required")
	}

	query := map[string]string{
		"channel": args.Channel,
	}
	if args.Limit > 0 {
		query["limit"] = strconv.Itoa(args.Limit)
	}

	return connector.Do(ctx, ec, connector.Spec{
		Method:  "GET",
		BaseURL: baseURL,
		Path:    "/api/conversations.history",
		Query:   query,
	})
}

func init() {
	integrations.Register(ConversationsHistory{})
	integrations.Register(FindMessage{})
}

type FindMessage struct{}

type findMessageArgs struct {
	Channel string `json:"channel"`
	Keyword string `json:"keyword"`
	Limit   int    `json:"limit"`
}

func (FindMessage) Kind() string { return FindMessageKind }

func (FindMessage) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	var args findMessageArgs
	if err := integrations.DecodeArgs(ec.Parameters, &args); err != nil {
		return nil, err
	}
	if args.Channel == "" {
		return nil, errors.New("argument 'channel' is required")
	}
	if args.Keyword == "" {
		return nil, errors.New("argument 'keyword' is required")
	}
	limit := args.Limit
	if limit <= 0 {
		limit = 100
	}

	res, err := connector.Do(ctx, ec, connector.Spec{
		Method:  "GET",
		BaseURL: baseURL,
		Path:    "/api/conversations.history",
		Query: map[string]string{
			"channel": args.Channel,
			"limit":   strconv.Itoa(limit),
		},
	})
	if err != nil {
		return nil, err
	}

	body, ok := res["body"].(map[string]any)
	if !ok {
		return map[string]any{"found": false}, nil
	}
	messagesRaw, ok := body["messages"].([]any)
	if !ok {
		return map[string]any{"found": false}, nil
	}

	for _, mRaw := range messagesRaw {
		msg, ok := mRaw.(map[string]any)
		if !ok {
			continue
		}
		text, _ := msg["text"].(string)
		if strings.Contains(text, args.Keyword) {
			return map[string]any{
				"found":   true,
				"message": msg,
			}, nil
		}
	}

	return map[string]any{"found": false}, nil
}
