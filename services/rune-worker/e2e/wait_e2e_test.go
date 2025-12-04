//go:build integration
// +build integration

package e2e

import (
	"context"
	"testing"
	"time"

	"rune-worker/pkg/core"
	"rune-worker/pkg/messages"
	"rune-worker/pkg/messaging"
	"rune-worker/pkg/platform/config"
	"rune-worker/pkg/platform/queue"
	"rune-worker/pkg/scheduler"
	testutils "rune-worker/test_utils"
)

func TestWaitNodeE2E(t *testing.T) {
	env := setupE2ETest(t)
	defer env.Cleanup(t)

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	workflowID := "test-wait-workflow"
	executionID := "exec-wait-001"

	executionMsg := &messages.NodeExecutionMessage{
		WorkflowID:  workflowID,
		ExecutionID: executionID,
		CurrentNode: "wait-node-1",
		WorkflowDefinition: core.Workflow{
			WorkflowID:  workflowID,
			ExecutionID: executionID,
			Nodes: []core.Node{
				{
					ID:   "wait-node-1",
					Name: "Wait Node",
					Type: "wait",
					Parameters: map[string]interface{}{
						"amount": 1,
						"unit":   "seconds",
					},
				},
			},
			Edges: []core.Edge{},
		},
		AccumulatedContext: map[string]interface{}{},
	}

	msgBytes, _ := executionMsg.Encode()
	if err := env.Publisher.Publish(ctx, "workflow.execution", msgBytes); err != nil {
		t.Fatalf("Failed to publish: %v", err)
	}

	statusConsumer, _ := queue.NewRabbitMQConsumer(queue.Options{
		URL:         env.RabbitMQURL,
		QueueName:   "workflow.node.status",
		Prefetch:    10,
		Concurrency: 1,
	})
	defer statusConsumer.Close()

	var statusMsgs []*messages.NodeStatusMessage
	statusChan := make(chan *messages.NodeStatusMessage, 10)
	statusCtx, statusCancel := context.WithTimeout(ctx, 15*time.Second)
	defer statusCancel()

	go func() {
		_ = statusConsumer.Consume(statusCtx, func(ctx context.Context, payload []byte) error {
			msg, _ := messages.DecodeNodeStatusMessage(payload)
			if msg != nil && msg.WorkflowID == workflowID {
				statusChan <- msg
			}
			return nil
		})
	}()

	cfg := &config.WorkerConfig{
		RabbitURL:   env.RabbitMQURL,
		RedisURL:    "redis://" + testutils.DefaultRedisAddr + "/0",
		QueueName:   "workflow.execution",
		Prefetch:    1,
		Concurrency: 1,
	}

	consumer, _ := messaging.NewWorkflowConsumer(cfg, env.RedisClient)
	defer consumer.Close()

	schedulerPub, _ := queue.NewRabbitMQPublisher(env.RabbitMQURL)
	defer schedulerPub.Close()

	sched := scheduler.NewScheduler(env.RedisClient, schedulerPub, scheduler.Options{
		PollInterval: 100 * time.Millisecond,
	})

	resumeConsumer, _ := messaging.NewResumeConsumer(cfg, env.RedisClient)
	defer resumeConsumer.Close()

	consumerCtx, consumerCancel := context.WithTimeout(ctx, 10*time.Second)
	defer consumerCancel()

	go func() { _ = consumer.Run(consumerCtx) }()
	go func() { _ = sched.Run(consumerCtx) }()
	go func() { _ = resumeConsumer.Run(consumerCtx) }()

	timeout := time.After(8 * time.Second)
	waitingReceived := false
loop:
	for {
		select {
		case msg := <-statusChan:
			statusMsgs = append(statusMsgs, msg)
			if msg.Status == messages.StatusWaiting {
				waitingReceived = true
			}
		case <-timeout:
			break loop
		}
	}

	if !waitingReceived {
		t.Error("Expected waiting status")
	}

	t.Log("Wait node E2E test completed")
}
