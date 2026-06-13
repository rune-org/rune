package telegram

import (
	"context"
	"errors"
	"fmt"

	"rune-worker/pkg/integrations"
	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

type GetChatID struct{}

func (GetChatID) Kind() string {
	return GetChatIDKind
}

func (GetChatID) Execute(ctx context.Context, ec plugin.ExecutionContext) (map[string]any, error) {
	token, err := botTokenFromCredentials(ec.GetCredentials())
	if err != nil {
		return nil, err
	}

	raw, err := connector.Do(ctx, ec, connector.Spec{
		Method:  "POST",
		BaseURL: baseURL,
		Path:    "/bot{token}/getUpdates",
		PathArgs: map[string]string{
			"token": token,
		},
		RedactedPathKeys: []string{"token"},
		Body: map[string]any{
			"limit": 1,
		},
	})
	if err != nil {
		return nil, err
	}

	respBody, _ := raw["body"].(map[string]any)
	if respBody == nil {
		return nil, errors.New("unexpected response from Telegram")
	}

	ok, _ := respBody["ok"].(bool)
	if !ok {
		desc, _ := respBody["description"].(string)
		code, _ := respBody["error_code"].(float64)
		if desc != "" {
			return nil, fmt.Errorf("telegram API error (%v): %s", int64(code), desc)
		}
		return nil, fmt.Errorf("telegram API error (code %v)", int64(code))
	}

	results, _ := respBody["result"].([]any)
	if len(results) == 0 {
		botName, _ := getBotUsername(ctx, ec, token)
		if botName != "" {
			return nil, fmt.Errorf("no messages yet. Open Telegram, search for @%s, and send any message. Then run this node again", botName)
		}
		return nil, errors.New("no messages yet. Send a message to your bot in Telegram first, then run this node again")
	}

	// Telegram returns updates oldest-first. Find the latest one.
	var latestUpdate map[string]any
	var maxUpdateID float64
	for _, r := range results {
		update, _ := r.(map[string]any)
		if update == nil {
			continue
		}
		id, _ := update["update_id"].(float64)
		if latestUpdate == nil || id > maxUpdateID {
			latestUpdate = update
			maxUpdateID = id
		}
	}

	chat := findChat(latestUpdate)
	if chat == nil {
		return nil, errors.New("no chat found in updates. Send a message to your bot in Telegram, then try again")
	}

	chatID, _ := chat["id"].(float64)
	chatType, _ := chat["type"].(string)

	var chatName string
	if t, ok := chat["title"].(string); ok {
		chatName = t
	} else if fn, ok := chat["first_name"].(string); ok {
		chatName = fn
		if ln, ok := chat["last_name"].(string); ok {
			chatName += " " + ln
		}
	}

	return map[string]any{
		"chat_id":   int64(chatID),
		"chat_type": chatType,
		"chat_name": chatName,
	}, nil
}

func getBotUsername(ctx context.Context, ec plugin.ExecutionContext, token string) (string, error) {
	raw, err := connector.Do(ctx, ec, connector.Spec{
		Method:           "POST",
		BaseURL:          baseURL,
		Path:             "/bot{token}/getMe",
		PathArgs:         map[string]string{"token": token},
		RedactedPathKeys: []string{"token"},
	})
	if err != nil {
		return "", err
	}
	body, _ := raw["body"].(map[string]any)
	if body == nil {
		return "", errors.New("empty response")
	}
	ok, _ := body["ok"].(bool)
	if !ok {
		return "", errors.New("api error")
	}
	result, _ := body["result"].(map[string]any)
	if result == nil {
		return "", errors.New("no result")
	}
	username, _ := result["username"].(string)
	return username, nil
}

func findChat(update map[string]any) map[string]any {
	for _, key := range []string{"message", "edited_message", "channel_post", "edited_channel_post", "my_chat_member"} {
		if obj, ok := update[key].(map[string]any); ok {
			if chat, ok := obj["chat"].(map[string]any); ok {
				return chat
			}
		}
	}
	return nil
}

func init() {
	integrations.Register(GetChatID{})
}
