package wait

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"rune-worker/pkg/messages"
	"rune-worker/pkg/nodes"
	"rune-worker/plugin"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// WaitNode implements the suspend logic: persist frozen execution and schedule resume.
// It does not emit output; it halts further execution for this branch.
type WaitNode struct{}

// NewWaitNode constructs a WaitNode.
func NewWaitNode(execCtx plugin.ExecutionContext) *WaitNode {
	return &WaitNode{}
}

// Execute stores the frozen execution in Redis and returns without publishing next nodes.
func (n *WaitNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	redisClient, ok := execCtx.RedisClient.(*redis.Client)
	if !ok || redisClient == nil {
		return nil, fmt.Errorf("wait node requires redis client")
	}

	amount, unit, err := parseInterval(execCtx.Parameters)
	if err != nil {
		return nil, err
	}

	resumeAt := time.Now().Add(convertToDuration(amount, unit)).UTC()

	// Freeze current execution message
	frozen := messages.NodeExecutionMessage{
		WorkflowID:         execCtx.WorkflowID,
		ExecutionID:        execCtx.ExecutionID,
		CurrentNode:        execCtx.NodeID,
		WorkflowDefinition: execCtx.Workflow,
		AccumulatedContext: execCtx.Input,
		LineageStack:       execCtx.LineageStack,
		FromNode:           execCtx.FromNode,
	}

	payload, err := frozen.Encode()
	if err != nil {
		return nil, fmt.Errorf("encode frozen state: %w", err)
	}

	timerID := uuid.NewString()

	// Atomic pipeline: store payload and schedule timer
	pipe := redisClient.TxPipeline()
	pipe.HSet(ctx, "scheduler:payloads", timerID, payload)
	pipe.ZAdd(ctx, "scheduler:timers", redis.Z{Score: float64(resumeAt.UnixMilli()), Member: timerID})
	if _, err := pipe.Exec(ctx); err != nil {
		return nil, fmt.Errorf("schedule wait timer: %w", err)
	}

	// Emit waiting status
	return map[string]any{
		"resume_at": resumeAt.UnixMilli(),
		"timer_id":  timerID,
	}, nil
}

func parseInterval(params map[string]any) (int, string, error) {
	// Defaults
	amount := 1
	unit := "seconds"

	if v, ok := params["amount"]; ok {
		switch t := v.(type) {
		case int:
			amount = t
		case float64:
			amount = int(t)
		case json.Number:
			if i, err := t.Int64(); err == nil {
				amount = int(i)
			}
		default:
			return 0, "", fmt.Errorf("invalid amount type %T", v)
		}
	}

	if v, ok := params["unit"].(string); ok && v != "" {
		unit = v
	}

	if amount < 0 {
		return 0, "", fmt.Errorf("amount must be non-negative")
	}

	switch unit {
	case "seconds", "minutes", "hours", "days":
	default:
		return 0, "", fmt.Errorf("invalid unit %s", unit)
	}

	return amount, unit, nil
}

func convertToDuration(amount int, unit string) time.Duration {
	switch unit {
	case "seconds":
		return time.Duration(amount) * time.Second
	case "minutes":
		return time.Duration(amount) * time.Minute
	case "hours":
		return time.Duration(amount) * time.Hour
	case "days":
		return time.Duration(amount) * 24 * time.Hour
	default:
		return time.Duration(amount) * time.Second
	}
}

func init() {
	nodes.RegisterNodeType(RegisterWait)
}

// RegisterWait registers the wait node type.
func RegisterWait(reg *nodes.Registry) {
	reg.Register("wait", func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewWaitNode(execCtx)
	})
}
