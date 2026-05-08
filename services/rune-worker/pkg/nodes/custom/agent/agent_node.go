package agent

import (
	"context"
	"fmt"

	adkagent "google.golang.org/adk/agent"
	"google.golang.org/adk/agent/llmagent"
	"google.golang.org/adk/runner"
	"google.golang.org/adk/session"

	"rune-worker/pkg/nodes"
	"rune-worker/plugin"
)

const (
	appName    = "rune-worker"
	agentLabel = "rune_agent"
)

type AgentNode struct {
	params   *agentParams
	parseErr error
}

func NewAgentNode(execCtx plugin.ExecutionContext) *AgentNode {
	p, err := parseParams(execCtx.Parameters)
	return &AgentNode{params: p, parseErr: err}
}

func (a *AgentNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	if a.parseErr != nil {
		return nil, a.parseErr
	}
	p := a.params

	model, err := buildModel(ctx, p.Model, execCtx.GetCredentials())
	if err != nil {
		return nil, err
	}

	tools, err := buildTools(p.Tools)
	if err != nil {
		return nil, err
	}
	toolsets, err := buildMCPToolsets(p.MCPServers)
	if err != nil {
		return nil, err
	}

	cfg := llmagent.Config{
		Name:                  agentLabel,
		Model:                 model,
		Tools:                 tools,
		Toolsets:              toolsets,
		GenerateContentConfig: buildGenerationConfig(p.Model),
	}
	if p.SystemPrompt != "" {
		// InstructionProvider bypasses ADK's {placeholder} template parsing so
		// literal braces in the user's prompt don't need escaping.
		prompt := p.SystemPrompt
		cfg.InstructionProvider = func(_ adkagent.ReadonlyContext) (string, error) {
			return prompt, nil
		}
	}

	llm, err := llmagent.New(cfg)
	if err != nil {
		return nil, fmt.Errorf("agent: build llmagent: %w", err)
	}

	history, lastUserContent, err := splitMessages(p.Messages)
	if err != nil {
		return nil, err
	}

	sessionService := session.InMemoryService()
	createResp, err := sessionService.Create(ctx, &session.CreateRequest{
		AppName: appName,
		UserID:  execCtx.ExecutionID,
	})
	if err != nil {
		return nil, fmt.Errorf("agent: create session: %w", err)
	}

	for _, msg := range history {
		ev := session.NewEvent("seed")
		ev.Author = "user"
		if msg.Role == "model" {
			ev.Author = agentLabel
		}
		ev.Content = msg
		if err := sessionService.AppendEvent(ctx, createResp.Session, ev); err != nil {
			return nil, fmt.Errorf("agent: seed session: %w", err)
		}
	}

	r, err := runner.New(runner.Config{
		AppName:        appName,
		Agent:          llm,
		SessionService: sessionService,
	})
	if err != nil {
		return nil, fmt.Errorf("agent: create runner: %w", err)
	}

	collector := newOutputCollector(p.Model.Name)
	for ev, evErr := range r.Run(
		ctx,
		execCtx.ExecutionID,
		createResp.Session.ID(),
		lastUserContent,
		adkagent.RunConfig{StreamingMode: adkagent.StreamingModeNone},
	) {
		if evErr != nil {
			return nil, fmt.Errorf("agent: run: %w", evErr)
		}
		collector.observe(ev)
	}

	return collector.result(), nil
}

func init() {
	nodes.RegisterNodeType(RegisterAgent)
}

func RegisterAgent(reg *nodes.Registry) {
	reg.Register("agent", func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewAgentNode(execCtx)
	})
}
