package scheduler

import (
	"context"
	"errors"
	"testing"
	"time"

	redismock "github.com/go-redis/redismock/v9"
)

type queueAwareMockPublisher struct {
	queue   string
	payload []byte
	err     error
}

func (m *queueAwareMockPublisher) Publish(ctx context.Context, queue string, payload []byte) error {
	if m.err != nil {
		return m.err
	}
	m.queue = queue
	m.payload = append([]byte(nil), payload...)
	return nil
}

func (m *queueAwareMockPublisher) Close() error {
	return nil
}

func TestNewSchedulerDefaults(t *testing.T) {
	t.Parallel()

	client, _ := redismock.NewClientMock()
	defer client.Close()

	s := NewScheduler(client, &queueAwareMockPublisher{}, Options{})
	if s.pollInterval != DefaultPollInterval {
		t.Fatalf("expected default poll interval %v, got %v", DefaultPollInterval, s.pollInterval)
	}
	if s.batchSize != DefaultBatchSize {
		t.Fatalf("expected default batch size %d, got %d", DefaultBatchSize, s.batchSize)
	}
}

func TestSchedulerProcessTimerSuccess(t *testing.T) {
	t.Parallel()

	client, mock := redismock.NewClientMock()
	defer client.Close()

	timerID := "timer-1"
	payload := []byte(`{"workflow_id":"wf-1"}`)

	mock.ExpectTxPipeline()
	mock.ExpectZRem(TimersKey, timerID).SetVal(1)
	mock.ExpectHGet(PayloadsKey, timerID).SetVal(string(payload))
	mock.ExpectHDel(PayloadsKey, timerID).SetVal(1)
	mock.ExpectTxPipelineExec()

	pub := &queueAwareMockPublisher{}
	s := NewScheduler(client, pub, Options{PollInterval: time.Second, BatchSize: 10})

	if err := s.processTimer(context.Background(), timerID); err != nil {
		t.Fatalf("processTimer failed: %v", err)
	}

	if pub.queue != "workflow.resume" {
		t.Fatalf("expected publish queue workflow.resume, got %s", pub.queue)
	}
	if string(pub.payload) != string(payload) {
		t.Fatalf("unexpected payload published: %s", string(pub.payload))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("redis expectations not met: %v", err)
	}
}

func TestSchedulerProcessTimerPublishFailure(t *testing.T) {
	t.Parallel()

	client, mock := redismock.NewClientMock()
	defer client.Close()

	timerID := "timer-fail"
	payload := []byte(`{"workflow_id":"wf-2"}`)

	mock.ExpectTxPipeline()
	mock.ExpectZRem(TimersKey, timerID).SetVal(1)
	mock.ExpectHGet(PayloadsKey, timerID).SetVal(string(payload))
	mock.ExpectHDel(PayloadsKey, timerID).SetVal(1)
	mock.ExpectTxPipelineExec()

	pub := &queueAwareMockPublisher{err: errors.New("publish failed")}
	s := NewScheduler(client, pub, Options{})

	if err := s.processTimer(context.Background(), timerID); err == nil {
		t.Fatalf("expected publish error")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("redis expectations not met: %v", err)
	}
}
