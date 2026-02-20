package messaging

import (
	"context"
	"errors"
	"strings"
	"testing"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
)

func makeResumeMessage() *messages.NodeExecutionMessage {
	return &messages.NodeExecutionMessage{
		WorkflowID:  "wf-resume",
		ExecutionID: "exec-resume",
		CurrentNode: "wait-1",
		WorkflowDefinition: core.Workflow{
			WorkflowID:  "wf-resume",
			ExecutionID: "exec-resume",
			Nodes: []core.Node{
				{ID: "wait-1", Name: "Wait", Type: "wait", Parameters: map[string]any{}},
				{ID: "next-1", Name: "Next", Type: "conditional", Parameters: map[string]any{"expression": "true"}},
			},
			Edges: []core.Edge{
				{ID: "edge-1", Src: "wait-1", Dst: "next-1"},
			},
		},
		AccumulatedContext: map[string]any{"$wait": map[string]any{"resume_at": 123}},
		LineageStack: []messages.StackFrame{
			{SplitNodeID: "split-1", BranchID: "branch-1", ItemIndex: 0, TotalItems: 2},
		},
	}
}

func TestResumeConsumerHandleResume_DecodeFailure(t *testing.T) {
	t.Parallel()

	consumer := &ResumeConsumer{}
	err := consumer.handleResume(context.Background(), []byte("invalid payload"))
	if err == nil {
		t.Fatalf("expected decode error")
	}
	if !strings.Contains(err.Error(), "decode resume message") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestResumeConsumerHandleResume_PublishesNextNode(t *testing.T) {
	t.Parallel()

	pub := newTestPublisher()
	consumer := &ResumeConsumer{publisher: pub}

	msg := makeResumeMessage()
	payload, err := msg.Encode()
	if err != nil {
		t.Fatalf("encode failed: %v", err)
	}

	if err := consumer.handleResume(context.Background(), payload); err != nil {
		t.Fatalf("handleResume failed: %v", err)
	}

	execMsgs := pub.published["workflow.execution"]
	if len(execMsgs) != 1 {
		t.Fatalf("expected 1 next-node message, got %d", len(execMsgs))
	}

	nextMsg, err := messages.DecodeNodeExecutionMessage(execMsgs[0])
	if err != nil {
		t.Fatalf("decode next message failed: %v", err)
	}

	if nextMsg.CurrentNode != "next-1" {
		t.Fatalf("expected next node next-1, got %s", nextMsg.CurrentNode)
	}
	if !nextMsg.IsWorkerInitiated {
		t.Fatalf("expected worker-initiated next message")
	}
	if len(nextMsg.LineageStack) != 1 || nextMsg.LineageStack[0].BranchID != "branch-1" {
		t.Fatalf("expected lineage stack to be preserved")
	}
}

func TestResumeConsumerHandleResume_PublishesCompletionWhenNoNextNode(t *testing.T) {
	t.Parallel()

	pub := newTestPublisher()
	consumer := &ResumeConsumer{publisher: pub}

	msg := makeResumeMessage()
	msg.WorkflowDefinition.Edges = nil
	payload, err := msg.Encode()
	if err != nil {
		t.Fatalf("encode failed: %v", err)
	}

	if err := consumer.handleResume(context.Background(), payload); err != nil {
		t.Fatalf("handleResume failed: %v", err)
	}

	completionMsgs := pub.published["workflow.completion"]
	if len(completionMsgs) != 1 {
		t.Fatalf("expected 1 completion message, got %d", len(completionMsgs))
	}

	completion, err := messages.DecodeCompletionMessage(completionMsgs[0])
	if err != nil {
		t.Fatalf("decode completion failed: %v", err)
	}
	if completion.Status != messages.CompletionStatusCompleted {
		t.Fatalf("expected completed status, got %s", completion.Status)
	}
}

func TestResumeConsumerHandleResume_NextNodePublishFailure(t *testing.T) {
	t.Parallel()

	pub := newTestPublisher()
	pub.failQueue["workflow.execution"] = errors.New("publish failed")
	consumer := &ResumeConsumer{publisher: pub}

	msg := makeResumeMessage()
	payload, err := msg.Encode()
	if err != nil {
		t.Fatalf("encode failed: %v", err)
	}

	err = consumer.handleResume(context.Background(), payload)
	if err == nil {
		t.Fatalf("expected publish error")
	}
}

func TestResumeConsumerClose_ClosesQueue(t *testing.T) {
	t.Parallel()

	q := &testQueue{}
	pub := newTestPublisher()
	consumer := &ResumeConsumer{
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
