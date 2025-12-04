package merge

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/nodes"
	"rune-worker/plugin"

	"github.com/redis/go-redis/v9"
)

//go:embed merge_wait_for_all.lua
var waitForAllScript string

const (
	waitModeAll     = "wait_for_all"
	waitModeAny     = "wait_for_any"
	mergeModeAppend = "append"
)

type mergeParams struct {
	Mode           string
	WaitMode       string
	TimeoutSeconds int
}

// MergeNode coordinates multiple branches converging on a single node using Redis for synchronization.
type MergeNode struct {
	redis       *redis.Client
	nodeID      string
	executionID string
	workflow    core.Workflow
	parameters  map[string]any
}

// NewMergeNode constructs a MergeNode instance.
func NewMergeNode(execCtx plugin.ExecutionContext) *MergeNode {
	var rc *redis.Client
	if client, ok := execCtx.RedisClient.(*redis.Client); ok {
		rc = client
	}

	return &MergeNode{
		redis:       rc,
		nodeID:      execCtx.NodeID,
		executionID: execCtx.ExecutionID,
		workflow:    execCtx.Workflow,
		parameters:  execCtx.Parameters,
	}
}

// Execute enforces merge semantics based on wait_mode.
func (n *MergeNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	if n.redis == nil {
		return nil, fmt.Errorf("merge node requires redis client")
	}

	params := parseMergeParams(n.parameters)
	prefix := fmt.Sprintf("exec:%s:node:%s", n.executionID, n.nodeID)

	n.ensureTimeoutFlag(ctx, prefix, params.TimeoutSeconds)

	switch params.WaitMode {
	case waitModeAll:
		return n.handleWaitForAll(ctx, prefix, execCtx, params)
	case waitModeAny:
		return n.handleWaitForAny(ctx, prefix, execCtx)
	default:
		return nil, fmt.Errorf("unsupported wait_mode: %s", params.WaitMode)
	}
}

func (n *MergeNode) handleWaitForAll(ctx context.Context, prefix string, execCtx plugin.ExecutionContext, params mergeParams) (map[string]any, error) {
	if execCtx.FromNode == "" {
		return nil, fmt.Errorf("merge node requires from_node when wait_mode=wait_for_all")
	}

	expected := len(n.workflow.GetIncomingEdges(n.nodeID))
	if expected == 0 {
		expected = 1
	}

	payloadBytes, err := json.Marshal(execCtx.Input)
	if err != nil {
		return nil, fmt.Errorf("marshal incoming payload: %w", err)
	}

	result, err := n.redis.Eval(ctx, waitForAllScript, []string{prefix + ":barrier"}, execCtx.FromNode, string(payloadBytes), expected).Result()
	if err == redis.Nil {
		arrivals, _ := n.redis.SCard(ctx, prefix+":barrier:arrivals").Result()
		return map[string]any{
			"_merge_waiting":  true,
			"_merge_arrived":  int(arrivals),
			"_merge_expected": expected,
		}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("wait_for_all lua error: %w", err)
	}

	data, err := decodeMergeResults(result)
	if err != nil {
		return nil, err
	}

	mergedContext, mergedPayloads, err := buildMergedContext(data, params.Mode)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"merged_context":  mergedContext,
		"_merge_payloads": mergedPayloads,
		"_merge_expected": expected,
	}, nil
}

func (n *MergeNode) handleWaitForAny(ctx context.Context, prefix string, execCtx plugin.ExecutionContext) (map[string]any, error) {
	lockKey := prefix + ":lock"
	winner, err := n.redis.SetNX(ctx, lockKey, execCtx.FromNode, 24*time.Hour).Result()
	if err != nil {
		return nil, fmt.Errorf("acquire merge lock: %w", err)
	}

	if !winner {
		return map[string]any{"_merge_ignored": true}, nil
	}

	return map[string]any{
		"merged_context": execCtx.Input,
		"_merge_winner":  execCtx.FromNode,
	}, nil
}

func (n *MergeNode) ensureTimeoutFlag(ctx context.Context, prefix string, timeoutSeconds int) {
	flagKey := prefix + ":timeout_active"
	if _, err := n.redis.SetNX(ctx, flagKey, "1", time.Duration(timeoutSeconds)*time.Second).Result(); err != nil {
		slog.Warn("merge node failed to set timeout flag", "node_id", n.nodeID, "error", err)
	}
}

func parseMergeParams(params map[string]any) mergeParams {
	mp := mergeParams{Mode: mergeModeAppend, WaitMode: waitModeAll, TimeoutSeconds: 300}
	if params == nil {
		return mp
	}

	if v, ok := params["mode"].(string); ok && v != "" {
		mp.Mode = v
	}
	if v, ok := params["wait_mode"].(string); ok && v != "" {
		mp.WaitMode = v
	}
	switch v := params["timeout"].(type) {
	case int:
		mp.TimeoutSeconds = v
	case int64:
		mp.TimeoutSeconds = int(v)
	case float64:
		mp.TimeoutSeconds = int(v)
	case string:
		if parsed, err := strconv.Atoi(v); err == nil {
			mp.TimeoutSeconds = parsed
		}
	}

	if mp.TimeoutSeconds <= 0 {
		mp.TimeoutSeconds = 300
	}

	return mp
}

func decodeMergeResults(result any) (map[string]string, error) {
	data := make(map[string]string)

	switch v := result.(type) {
	case []interface{}:
		if len(v)%2 != 0 {
			return nil, fmt.Errorf("unexpected merge result length %d", len(v))
		}
		for i := 0; i < len(v); i += 2 {
			key := fmt.Sprint(v[i])
			data[key] = fmt.Sprint(v[i+1])
		}
	default:
		return nil, fmt.Errorf("unexpected merge result type %T", result)
	}

	return data, nil
}

func buildMergedContext(data map[string]string, mode string) (map[string]any, []map[string]any, error) {
	merged := make(map[string]any)
	payloads := make([]map[string]any, 0, len(data))

	for _, payload := range data {
		var ctx map[string]any
		if err := json.Unmarshal([]byte(payload), &ctx); err != nil {
			return nil, nil, fmt.Errorf("unmarshal payload: %w", err)
		}
		payloads = append(payloads, ctx)
		for k, v := range ctx {
			merged[k] = v
		}
	}

	// append mode currently merges maps; other modes can be added later
	_ = mode

	return merged, payloads, nil
}

func init() {
	nodes.RegisterNodeType(RegisterMerge)
}

// RegisterMerge registers the merge node type in the registry.
func RegisterMerge(reg *nodes.Registry) {
	reg.Register("merge", func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewMergeNode(execCtx)
	})
}
