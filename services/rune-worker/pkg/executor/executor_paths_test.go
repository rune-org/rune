package executor

import (
	"context"
	"testing"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/nodes"
	"rune-worker/plugin"
)

func TestExecutorExecuteWaitNodePublishesWaitingStatusOnly(t *testing.T) {
	t.Parallel()

	pub := NewMockPublisher()
	reg := nodes.NewRegistry()
	reg.Register("wait", func(execCtx plugin.ExecutionContext) plugin.Node {
		return &MockNode{
			output: map[string]any{
				"resume_at": int64(1234),
				"timer_id":  "timer-1",
			},
		}
	})

	exec := NewExecutor(reg, pub, nil)
	msg := &messages.NodeExecutionMessage{
		WorkflowID:  "wf-wait",
		ExecutionID: "exec-wait",
		CurrentNode: "wait-1",
		WorkflowDefinition: core.Workflow{
			WorkflowID:  "wf-wait",
			ExecutionID: "exec-wait",
			Nodes: []core.Node{
				{ID: "wait-1", Name: "Wait Node", Type: "wait", Parameters: map[string]any{}},
			},
		},
		AccumulatedContext: map[string]any{},
	}

	if err := exec.Execute(context.Background(), msg); err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	statusMsgs := pub.GetPublishedMessages("workflow.node.status")
	if len(statusMsgs) != 2 {
		t.Fatalf("expected 2 status messages (running+waiting), got %d", len(statusMsgs))
	}

	waiting, err := messages.DecodeNodeStatusMessage(statusMsgs[1])
	if err != nil {
		t.Fatalf("decode waiting message failed: %v", err)
	}
	if waiting.Status != messages.StatusWaiting {
		t.Fatalf("expected waiting status, got %s", waiting.Status)
	}

	if pub.GetPublishedCount("workflow.execution") != 0 {
		t.Fatalf("expected no next-node messages for wait node")
	}
	if pub.GetPublishedCount("workflow.completion") != 0 {
		t.Fatalf("expected no completion message for wait node")
	}
}

func TestExecutorHandleSplitFanOutPublishesPerItemAndNode(t *testing.T) {
	t.Parallel()

	pub := NewMockPublisher()
	exec := NewExecutor(nodes.NewRegistry(), pub, nil)

	msg := &messages.NodeExecutionMessage{
		WorkflowID:  "wf-split",
		ExecutionID: "exec-split",
		CurrentNode: "split-1",
		WorkflowDefinition: core.Workflow{
			WorkflowID:  "wf-split",
			ExecutionID: "exec-split",
			Nodes: []core.Node{
				{ID: "split-1", Name: "Split", Type: "split", Parameters: map[string]any{}},
				{ID: "next-a", Name: "Next A", Type: "conditional", Parameters: map[string]any{"expression": "true"}},
				{ID: "next-b", Name: "Next B", Type: "conditional", Parameters: map[string]any{"expression": "true"}},
			},
		},
		AccumulatedContext: map[string]any{"$trigger": "ok"},
	}

	node := &core.Node{
		ID:   "split-1",
		Name: "Split",
		Type: "split",
	}

	nextNodes := []string{"next-a", "next-b"}
	items := []any{"item-1", "item-2"}
	baseContext := map[string]any{"$trigger": "ok"}

	if err := exec.handleSplitFanOut(context.Background(), msg, node, nextNodes, items, baseContext); err != nil {
		t.Fatalf("handleSplitFanOut failed: %v", err)
	}

	execMsgs := pub.GetPublishedMessages("workflow.execution")
	if len(execMsgs) != 4 {
		t.Fatalf("expected 4 published messages (2 items x 2 nodes), got %d", len(execMsgs))
	}

	first, err := messages.DecodeNodeExecutionMessage(execMsgs[0])
	if err != nil {
		t.Fatalf("decode first fan-out message failed: %v", err)
	}

	if first.AccumulatedContext["$item"] != "item-1" {
		t.Fatalf("expected first item in context, got %v", first.AccumulatedContext["$item"])
	}
	if len(first.LineageStack) != 1 {
		t.Fatalf("expected lineage stack length 1, got %d", len(first.LineageStack))
	}
	if first.LineageStack[0].SplitNodeID != "split-1" {
		t.Fatalf("unexpected split node id in lineage: %s", first.LineageStack[0].SplitNodeID)
	}
	if _, ok := baseContext["$item"]; ok {
		t.Fatalf("base context must not be mutated with $item")
	}
}

func TestExecutorDetermineNextNodesConditionalAndSwitch(t *testing.T) {
	t.Parallel()

	exec := NewExecutor(nodes.NewRegistry(), NewMockPublisher(), nil)

	conditionalNode := &core.Node{
		ID:   "cond-1",
		Type: "conditional",
		Parameters: map[string]any{
			"true_edge_id":  "edge-true",
			"false_edge_id": "edge-false",
		},
	}

	switchNode := &core.Node{
		ID:   "switch-1",
		Type: "switch",
		Parameters: map[string]any{
			"routes": []interface{}{"edge-a", "edge-b"},
		},
	}

	wf := &core.Workflow{
		Nodes: []core.Node{
			{ID: "cond-1"},
			{ID: "switch-1"},
			{ID: "node-true"},
			{ID: "node-false"},
			{ID: "node-a"},
			{ID: "node-b"},
		},
		Edges: []core.Edge{
			{ID: "edge-true", Src: "cond-1", Dst: "node-true"},
			{ID: "edge-false", Src: "cond-1", Dst: "node-false"},
			{ID: "edge-a", Src: "switch-1", Dst: "node-a"},
			{ID: "edge-b", Src: "switch-1", Dst: "node-b"},
		},
	}

	next := exec.determineNextNodes(wf, conditionalNode, map[string]any{"result": true})
	if len(next) != 1 || next[0] != "node-true" {
		t.Fatalf("unexpected conditional true route: %v", next)
	}

	next = exec.determineNextNodes(wf, conditionalNode, map[string]any{"result": false})
	if len(next) != 1 || next[0] != "node-false" {
		t.Fatalf("unexpected conditional false route: %v", next)
	}

	next = exec.determineNextNodes(wf, switchNode, map[string]any{"output_index": float64(1)})
	if len(next) != 1 || next[0] != "node-b" {
		t.Fatalf("unexpected switch route: %v", next)
	}

	next = exec.determineNextNodes(wf, switchNode, map[string]any{"output_index": 10})
	if len(next) != 0 {
		t.Fatalf("expected empty route for out-of-bounds index, got %v", next)
	}
}

func TestExecutorGetNodeByErrorEdge(t *testing.T) {
	t.Parallel()

	exec := NewExecutor(nodes.NewRegistry(), NewMockPublisher(), nil)

	wf := &core.Workflow{
		Nodes: []core.Node{
			{ID: "node-1", Name: "Node 1"},
			{ID: "error-node", Name: "Error Node"},
		},
		Edges: []core.Edge{
			{ID: "error-edge", Src: "node-1", Dst: "error-node"},
		},
	}

	node := exec.getNodeByErrorEdge(wf, "error-edge")
	if node == nil || node.ID != "error-node" {
		t.Fatalf("expected error node, got %+v", node)
	}

	missing := exec.getNodeByErrorEdge(wf, "missing-edge")
	if missing != nil {
		t.Fatalf("expected nil for missing edge, got %+v", missing)
	}
}
