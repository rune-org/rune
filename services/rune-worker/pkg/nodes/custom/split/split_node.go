package splitnode

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"rune-worker/pkg/nodes"
	"rune-worker/plugin"

	"github.com/redis/go-redis/v9"
)

// SplitNode implements the fan-out pattern.
type SplitNode struct {
	input       map[string]any
	parameters  map[string]any
	redisClient *redis.Client
	nodeID      string
	executionID string
}

// NewSplitNode creates a new SplitNode instance.
func NewSplitNode(execCtx plugin.ExecutionContext) *SplitNode {
	var rc *redis.Client
	if execCtx.RedisClient != nil {
		if client, ok := execCtx.RedisClient.(*redis.Client); ok {
			rc = client
		}
	}

	return &SplitNode{
		input:       execCtx.Input,
		parameters:  execCtx.Parameters,
		redisClient: rc,
		nodeID:      execCtx.NodeID,
		executionID: execCtx.ExecutionID,
	}
}

// Execute evaluates the input array and sets the expected count in Redis.
func (n *SplitNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	// 1. Resolve input_array
	inputArrayParam, ok := n.parameters["input_array"]
	if !ok {
		return nil, fmt.Errorf("missing required parameter: input_array")
	}

	var items []any
	switch v := inputArrayParam.(type) {
	case []any:
		items = v
	case []string:
		for _, s := range v {
			items = append(items, s)
		}
	case []int:
		for _, i := range v {
			items = append(items, i)
		}
	case []float64:
		for _, f := range v {
			items = append(items, f)
		}
	case []map[string]any:
		for _, m := range v {
			items = append(items, m)
		}
	default:
		return nil, fmt.Errorf("input_array must be an array/slice, got %T", v)
	}

	count := len(items)
	slog.Info("split node resolved items", "count", count, "node_id", n.nodeID)

	// 2. Set expected count in Redis
	if n.redisClient != nil {
		key := fmt.Sprintf("exec:%s:split:%s:expected", n.executionID, n.nodeID)
		err := n.redisClient.Set(ctx, key, count, 24*time.Hour).Err()
		if err != nil {
			return nil, fmt.Errorf("failed to set expected count in redis: %w", err)
		}
	} else {
		slog.Warn("redis client not available in split node, skipping state persistence")
	}

	// 3. Return items for Executor to handle fan-out
	return map[string]any{
		"_split_items": items,
	}, nil
}

func init() {
	nodes.RegisterNodeType(RegisterSplit)
}

// RegisterSplit registers the split node type.
func RegisterSplit(reg *nodes.Registry) {
	reg.Register("split", func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewSplitNode(execCtx)
	})
}
