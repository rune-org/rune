package executor

import (
	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
)

func (e *Executor) enrichStatusWithLineage(status *messages.NodeStatusMessage, stack []messages.StackFrame) {
	if status == nil || len(stack) == 0 {
		return
	}

	status.LineageStack = append(status.LineageStack, stack...)
	top := stack[len(stack)-1]
	status.BranchID = top.BranchID
	status.SplitNodeID = top.SplitNodeID
	status.ItemIndex = intPointer(top.ItemIndex)
	status.TotalItems = intPointer(top.TotalItems)
}

func (e *Executor) applyAggregatorMetadata(status *messages.NodeStatusMessage, node *core.Node, output map[string]any) {
	if status == nil || node == nil || node.Type != "aggregator" {
		return
	}

	if output != nil {
		if processed, ok := extractInt(output, "_aggregator_processed_count"); ok {
			status.ProcessedCount = intPointer(processed)
		}
		if _, waiting := output["_barrier_closed"]; waiting {
			status.AggregatorState = messages.AggregatorStateWaiting
		} else if _, released := output["aggregated"]; released {
			status.AggregatorState = messages.AggregatorStateReleased
		}
	}

	if status.AggregatorState == "" {
		status.AggregatorState = messages.AggregatorStateReleased
	}

	if status.AggregatorState == messages.AggregatorStateReleased && status.ProcessedCount == nil && status.TotalItems != nil {
		status.ProcessedCount = intPointer(*status.TotalItems)
	}
}

func extractInt(data map[string]any, key string) (int, bool) {
	if data == nil {
		return 0, false
	}
	val, ok := data[key]
	if !ok {
		return 0, false
	}
	switch v := val.(type) {
	case int:
		return v, true
	case int64:
		return int(v), true
	case float64:
		return int(v), true
	default:
		return 0, false
	}
}

func intPointer(value int) *int {
	v := value
	return &v
}
