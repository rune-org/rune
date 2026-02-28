package aggregatornode

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"log/slog"

	"rune-worker/pkg/nodes"
	"rune-worker/plugin"

	"github.com/redis/go-redis/v9"
)

//go:embed aggregate.lua
var aggregateScript string

// AggregatorNode implements the fan-in pattern.
type AggregatorNode struct {
	redisClient *redis.Client
	nodeID      string
	executionID string
	input       map[string]any
}

// NewAggregatorNode creates a new AggregatorNode instance.
func NewAggregatorNode(execCtx plugin.ExecutionContext) *AggregatorNode {
	var rc *redis.Client
	if execCtx.RedisClient != nil {
		if client, ok := execCtx.RedisClient.(*redis.Client); ok {
			rc = client
		}
	}

	return &AggregatorNode{
		redisClient: rc,
		nodeID:      execCtx.NodeID,
		executionID: execCtx.ExecutionID,
		input:       execCtx.Input,
	}
}

// Execute synchronizes execution threads.
func (n *AggregatorNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	if n.redisClient == nil {
		return nil, fmt.Errorf("aggregator node requires redis client")
	}

	stack := execCtx.LineageStack
	if len(stack) == 0 {
		return nil, fmt.Errorf("aggregator node must be executed within a split context")
	}

	topFrame := stack[len(stack)-1]
	splitID := topFrame.SplitNodeID

	// Keys
	resultsKey := fmt.Sprintf("exec:%s:split:%s:results", n.executionID, splitID)
	countKey := fmt.Sprintf("exec:%s:split:%s:count", n.executionID, splitID)
	expectedKey := fmt.Sprintf("exec:%s:split:%s:expected", n.executionID, splitID)

	payloadBytes, err := json.Marshal(n.input)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal input: %w", err)
	}

	// Run Lua script
	cmd := n.redisClient.Eval(ctx, aggregateScript,
		[]string{resultsKey, countKey, expectedKey},
		topFrame.ItemIndex, string(payloadBytes))

	result, err := cmd.Result()
	if err != nil {
		if err == redis.Nil {
			// Barrier closed
			slog.Info("aggregator barrier closed", "node_id", n.nodeID, "index", topFrame.ItemIndex)
			processed := topFrame.ItemIndex + 1
			if cnt, countErr := n.redisClient.Get(ctx, countKey).Int(); countErr == nil {
				processed = cnt
			}
			return map[string]any{
				"_barrier_closed":             true,
				"_aggregator_processed_count": processed,
			}, nil
		}
		return nil, fmt.Errorf("lua script failed: %w", err)
	}

	// Barrier open!
	slog.Info("aggregator barrier open", "node_id", n.nodeID)

	var aggregatedResults []any
	if str, ok := result.(string); ok {
		if err := json.Unmarshal([]byte(str), &aggregatedResults); err != nil {
			return nil, fmt.Errorf("failed to unmarshal aggregated results: %w", err)
		}
	} else {
		return nil, fmt.Errorf("unexpected result type from lua: %T", result)
	}

	return map[string]any{
		"aggregated": aggregatedResults,
	}, nil
}

func init() {
	nodes.RegisterNodeType(RegisterAggregator)
}

// RegisterAggregator registers the aggregator node type.
func RegisterAggregator(reg *nodes.Registry) {
	reg.Register("aggregator", func(execCtx plugin.ExecutionContext) plugin.Node {
		return NewAggregatorNode(execCtx)
	})
}
