package agent

import (
	"google.golang.org/adk/session"
	"google.golang.org/genai"
)

// outputCollector folds runner events into the agent node's output map:
// { messages, final_response, tool_calls, model, usage }.
type outputCollector struct {
	model       string
	messages    []map[string]any
	toolCalls   []map[string]any
	toolByID    map[string]int // index into toolCalls
	finalText   string
	promptTok   int32
	respTok     int32
	totalTok    int32
}

func newOutputCollector(modelName string) *outputCollector {
	return &outputCollector{
		model:    modelName,
		toolByID: make(map[string]int),
	}
}

func (oc *outputCollector) observe(ev *session.Event) {
	if ev == nil || ev.Content == nil {
		oc.captureUsage(ev)
		return
	}
	role := ev.Content.Role

	textParts := ""
	for _, p := range ev.Content.Parts {
		switch {
		case p.FunctionCall != nil:
			oc.recordCall(p.FunctionCall)
		case p.FunctionResponse != nil:
			oc.recordResponse(p.FunctionResponse)
		case p.Text != "":
			textParts += p.Text
		}
	}

	if textParts != "" {
		oc.messages = append(oc.messages, map[string]any{
			"role":    role,
			"content": textParts,
		})
		if role == genai.RoleModel && ev.IsFinalResponse() {
			oc.finalText = textParts
		}
	}

	oc.captureUsage(ev)
}

func (oc *outputCollector) recordCall(fc *genai.FunctionCall) {
	entry := map[string]any{
		"id":   fc.ID,
		"name": fc.Name,
		"args": fc.Args,
	}
	oc.toolByID[fc.ID] = len(oc.toolCalls)
	oc.toolCalls = append(oc.toolCalls, entry)
}

func (oc *outputCollector) recordResponse(fr *genai.FunctionResponse) {
	if idx, ok := oc.toolByID[fr.ID]; ok {
		oc.toolCalls[idx]["response"] = fr.Response
		return
	}
	// Orphan response (no matching call recorded) — append standalone for visibility.
	oc.toolCalls = append(oc.toolCalls, map[string]any{
		"id":       fr.ID,
		"name":     fr.Name,
		"response": fr.Response,
	})
}

func (oc *outputCollector) captureUsage(ev *session.Event) {
	if ev == nil || ev.UsageMetadata == nil {
		return
	}
	u := ev.UsageMetadata
	// Token counts grow monotonically across the run; keep the last seen values.
	oc.promptTok = u.PromptTokenCount
	oc.respTok = u.CandidatesTokenCount
	oc.totalTok = u.TotalTokenCount
}

func (oc *outputCollector) result() map[string]any {
	return map[string]any{
		"messages":       oc.messages,
		"final_response": oc.finalText,
		"tool_calls":     oc.toolCalls,
		"model":          oc.model,
		"usage": map[string]any{
			"prompt_tokens":     oc.promptTok,
			"completion_tokens": oc.respTok,
			"total_tokens":      oc.totalTok,
		},
	}
}
