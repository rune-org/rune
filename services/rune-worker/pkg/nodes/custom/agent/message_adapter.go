package agent

import (
	"fmt"

	"google.golang.org/genai"
)

// splitMessages peels the trailing user turn off the messages list so it can
// be passed as runner.Run's `content` argument; everything before becomes
// session history. The last message must have role "user".
func splitMessages(msgs []message) (history []*genai.Content, last *genai.Content, err error) {
	if len(msgs) == 0 {
		return nil, nil, fmt.Errorf("agent: at least one message is required")
	}
	tail := msgs[len(msgs)-1]
	if tail.Role != "user" {
		return nil, nil, fmt.Errorf("agent: last message must have role \"user\" (got %q)", tail.Role)
	}

	for i := 0; i < len(msgs)-1; i++ {
		history = append(history, genai.NewContentFromText(msgs[i].Content, genai.Role(msgs[i].Role)))
	}
	last = genai.NewContentFromText(tail.Content, genai.RoleUser)
	return history, last, nil
}
