package scheduler

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"rune-worker/pkg/platform/queue"

	"github.com/redis/go-redis/v9"
)

const (
	// TimersKey is the Redis sorted set key for scheduled timers
	TimersKey = "scheduler:timers"
	// PayloadsKey is the Redis hash key for frozen payloads
	PayloadsKey = "scheduler:payloads"
	// DefaultPollInterval is the default interval between scheduler polls
	DefaultPollInterval = 500 * time.Millisecond
	// DefaultBatchSize is the number of due timers to process per poll
	DefaultBatchSize = 100
	// PublishRetryDelay is the delay before retrying a timer after publish failure
	PublishRetryDelay = 1 * time.Second
)

// Scheduler polls Redis for due wait timers and publishes resume messages.
type Scheduler struct {
	redis        *redis.Client
	publisher    queue.Publisher
	pollInterval time.Duration
	batchSize    int
}

// Options configures the scheduler.
type Options struct {
	PollInterval time.Duration
	BatchSize    int
}

// NewScheduler creates a new scheduler instance.
func NewScheduler(redisClient *redis.Client, publisher queue.Publisher, opts Options) *Scheduler {
	if opts.PollInterval <= 0 {
		opts.PollInterval = DefaultPollInterval
	}
	if opts.BatchSize <= 0 {
		opts.BatchSize = DefaultBatchSize
	}

	return &Scheduler{
		redis:        redisClient,
		publisher:    publisher,
		pollInterval: opts.PollInterval,
		batchSize:    opts.BatchSize,
	}
}

// Run starts the scheduler loop. It blocks until the context is cancelled.
func (s *Scheduler) Run(ctx context.Context) error {
	slog.Info("scheduler starting",
		"poll_interval", s.pollInterval,
		"batch_size", s.batchSize,
	)

	ticker := time.NewTicker(s.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("scheduler stopping")
			return ctx.Err()
		case <-ticker.C:
			if err := s.poll(ctx); err != nil {
				slog.Error("scheduler poll error", "error", err)
			}
		}
	}
}

// poll checks for due timers and processes them.
func (s *Scheduler) poll(ctx context.Context) error {
	now := time.Now().UnixMilli()

	// Get due timer IDs (score <= now)
	timerIDs, err := s.redis.ZRangeByScore(ctx, TimersKey, &redis.ZRangeBy{
		Min:   "-inf",
		Max:   fmt.Sprintf("%d", now),
		Count: int64(s.batchSize),
	}).Result()

	if err != nil {
		return err
	}

	if len(timerIDs) == 0 {
		return nil
	}

	slog.Debug("processing due timers", "count", len(timerIDs))

	for _, timerID := range timerIDs {
		if err := s.processTimer(ctx, timerID); err != nil {
			slog.Error("failed to process timer",
				"timer_id", timerID,
				"error", err,
			)
			// Continue processing other timers
		}
	}

	return nil
}

// processTimer handles a single due timer atomically.
func (s *Scheduler) processTimer(ctx context.Context, timerID string) error {
	// Claim timer (remove from due set) and fetch payload in one transaction.
	// Payload is deleted only after successful publish.
	pipe := s.redis.TxPipeline()
	zremCmd := pipe.ZRem(ctx, TimersKey, timerID)
	getCmd := pipe.HGet(ctx, PayloadsKey, timerID)
	_, err := pipe.Exec(ctx)
	if err != nil && !errors.Is(err, redis.Nil) {
		return err
	}

	claimed, err := zremCmd.Result()
	if err != nil {
		return err
	}
	if claimed == 0 {
		slog.Debug("timer already claimed by another scheduler", "timer_id", timerID)
		return nil
	}

	payload, err := getCmd.Bytes()
	if err != nil {
		if err == redis.Nil {
			slog.Warn("timer payload not found, already processed?", "timer_id", timerID)
			return nil
		}
		return err
	}

	// Publish to workflow.resume queue
	if err := s.publisher.Publish(ctx, queue.QueueWorkflowResume, payload); err != nil {
		// Requeue timer for retry. Payload remains stored in Redis.
		retryAt := time.Now().Add(PublishRetryDelay).UnixMilli()
		if requeueErr := s.redis.ZAdd(ctx, TimersKey, redis.Z{
			Score:  float64(retryAt),
			Member: timerID,
		}).Err(); requeueErr != nil {
			slog.Error("failed to requeue timer after publish failure",
				"timer_id", timerID,
				"error", requeueErr,
			)
		}

		slog.Error("failed to publish resume message",
			"timer_id", timerID,
			"error", err,
		)
		return err
	}

	// Publish succeeded; remove payload.
	if err := s.redis.HDel(ctx, PayloadsKey, timerID).Err(); err != nil {
		return err
	}

	slog.Info("timer resumed",
		"timer_id", timerID,
	)

	return nil
}
