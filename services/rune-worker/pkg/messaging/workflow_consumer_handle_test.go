package messaging

import (
	"context"
	"errors"
	"strings"
	"testing"

	"rune-worker/pkg/core"
	"rune-worker/pkg/executor"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/nodes"
	"rune-worker/pkg/platform/queue"
	"rune-worker/plugin"
)

type testPublisher struct {
	published map[string][][]byte
	failQueue map[string]error
	closeErr  error
	closed    bool
}

func newTestPublisher() *testPublisher {
	return &testPublisher{
		published: make(map[string][][]byte),
		failQueue: make(map[string]error),
	}
}

func (p *testPublisher) Publish(ctx context.Context, queue string, payload []byte) error {
	if err, ok := p.failQueue[queue]; ok {
		return err
	}
	p.published[queue] = append(p.published[queue], payload)
	return nil
}

func (p *testPublisher) Close() error {
	p.closed = true
	return p.closeErr
}

type testQueue struct {
	closeErr error
	closed   bool
}

func (q *testQueue) Consume(ctx context.Context, handler queue.MessageHandler) error {
	return nil
}

func (q *testQueue) Close() error {
	q.closed = true
	return q.closeErr
}

type testNode struct {
	output map[string]any
	err    error
}

func (n *testNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
	if n.err != nil {
		return nil, n.err
	}
	return n.output, nil
}

func makeMessageForConsumer(isWorkerInitiated bool) *messages.NodeExecutionMessage {
	return &messages.NodeExecutionMessage{
		WorkflowID:  "wf-1",
		ExecutionID: "exec-1",
		CurrentNode: "node-1",
		WorkflowDefinition: core.Workflow{
			WorkflowID:  "wf-1",
			ExecutionID: "exec-1",
			Nodes: []core.Node{
				{
					ID:         "node-1",
					Name:       "Node 1",
					Type:       "mock",
					Parameters: map[string]any{},
				},
			},
			Edges: nil,
		},
		AccumulatedContext: map[string]any{"$trigger": true},
		IsWorkerInitiated:  isWorkerInitiated,
	}
}

func TestWorkflowConsumerHandleMessage_MasterMessagePublishesWorkerInitiated(t *testing.T) {
	t.Parallel()

	pub := newTestPublisher()
	reg := nodes.NewRegistry()
	reg.Register("mock", func(execCtx plugin.ExecutionContext) plugin.Node {
		return &testNode{output: map[string]any{"ok": true}}
	})

	consumer := &WorkflowConsumer{
		executor:  executor.NewExecutor(reg, pub, nil),
		publisher: pub,
	}

	msg := makeMessageForConsumer(false)
	payload, err := msg.Encode()
	if err != nil {
		t.Fatalf("encode failed: %v", err)
	}

	if err := consumer.handleMessage(context.Background(), payload); err != nil {
		t.Fatalf("handleMessage returned error: %v", err)
	}

	if len(pub.published["workflow.worker.initiated"]) != 1 {
		t.Fatalf("expected 1 worker initiated message, got %d", len(pub.published["workflow.worker.initiated"]))
	}
	if len(pub.published["workflow.node.status"]) != 2 {
		t.Fatalf("expected 2 status messages, got %d", len(pub.published["workflow.node.status"]))
	}
	if len(pub.published["workflow.completion"]) != 1 {
		t.Fatalf("expected 1 completion message, got %d", len(pub.published["workflow.completion"]))
	}
}

func TestWorkflowConsumerHandleMessage_DecodeFailure(t *testing.T) {
	t.Parallel()

	consumer := &WorkflowConsumer{}
	err := consumer.handleMessage(context.Background(), []byte("{invalid json"))
	if err == nil {
		t.Fatalf("expected decode error")
	}
	if !strings.Contains(err.Error(), "decode message") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestWorkflowConsumerHandleMessage_MasterPublishFailure(t *testing.T) {
	t.Parallel()

	pub := newTestPublisher()
	pub.failQueue["workflow.worker.initiated"] = errors.New("publish failed")

	reg := nodes.NewRegistry()
	reg.Register("mock", func(execCtx plugin.ExecutionContext) plugin.Node {
		return &testNode{output: map[string]any{"ok": true}}
	})

	consumer := &WorkflowConsumer{
		executor:  executor.NewExecutor(reg, pub, nil),
		publisher: pub,
	}

	msg := makeMessageForConsumer(false)
	payload, err := msg.Encode()
	if err != nil {
		t.Fatalf("encode failed: %v", err)
	}

	err = consumer.handleMessage(context.Background(), payload)
	if err == nil {
		t.Fatalf("expected publish error")
	}
	if !strings.Contains(err.Error(), "publish worker initiated message") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestWorkflowConsumerHandleMessage_ExecutorPublishFailure(t *testing.T) {
	t.Parallel()

	pub := newTestPublisher()
	pub.failQueue["workflow.execution"] = errors.New("next publish failed")

	reg := nodes.NewRegistry()
	reg.Register("mock", func(execCtx plugin.ExecutionContext) plugin.Node {
		return &testNode{output: map[string]any{"ok": true}}
	})

	consumer := &WorkflowConsumer{
		executor:  executor.NewExecutor(reg, pub, nil),
		publisher: pub,
	}

	msg := &messages.NodeExecutionMessage{
		WorkflowID:  "wf-1",
		ExecutionID: "exec-1",
		CurrentNode: "node-1",
		WorkflowDefinition: core.Workflow{
			WorkflowID:  "wf-1",
			ExecutionID: "exec-1",
			Nodes: []core.Node{
				{ID: "node-1", Name: "Node 1", Type: "mock", Parameters: map[string]any{}},
				{ID: "node-2", Name: "Node 2", Type: "mock", Parameters: map[string]any{}},
			},
			Edges: []core.Edge{
				{ID: "e1", Src: "node-1", Dst: "node-2"},
			},
		},
		AccumulatedContext: map[string]any{},
		IsWorkerInitiated:  true,
	}

	payload, err := msg.Encode()
	if err != nil {
		t.Fatalf("encode failed: %v", err)
	}

	err = consumer.handleMessage(context.Background(), payload)
	if err == nil {
		t.Fatalf("expected executor error")
	}
	if !strings.Contains(err.Error(), "execute node") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestWorkflowConsumerClose_ClosesQueue(t *testing.T) {
	t.Parallel()

	q := &testQueue{}
	pub := newTestPublisher()
	consumer := &WorkflowConsumer{
		queue:     q,
		publisher: pub,
	}

	if err := consumer.Close(); err != nil {
		t.Fatalf("close failed: %v", err)
	}
	if !q.closed {
		t.Fatalf("expected queue to be closed")
	}
	if !pub.closed {
		t.Fatalf("expected publisher to be closed")
	}
}
