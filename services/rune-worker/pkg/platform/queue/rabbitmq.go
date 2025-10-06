package queue

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/wagslane/go-rabbitmq"
)

// MessageHandler processes incoming raw message payloads.
type MessageHandler func(context.Context, []byte) error

// Consumer represents a message queue consumer capable of dispatching payloads to a handler.
type Consumer interface {
	Consume(context.Context, MessageHandler) error
	Close() error
}

// Options capture the settings required to establish a RabbitMQ consumer.
type Options struct {
	URL         string
	QueueName   string
	Prefetch    int
	Concurrency int
}

// RabbitMQConsumer wraps the go-rabbitmq consumer implementation.
type RabbitMQConsumer struct {
	queue    string
	conn     *rabbitmq.Conn
	consumer *rabbitmq.Consumer
}

// NewRabbitMQConsumer creates a consumer instance backed by RabbitMQ.
func NewRabbitMQConsumer(opts Options) (*RabbitMQConsumer, error) {
	if opts.URL == "" {
		return nil, errors.New("queue: rabbitmq url is required")
	}
	if opts.QueueName == "" {
		return nil, errors.New("queue: queue name is required")
	}
	if opts.Prefetch <= 0 {
		opts.Prefetch = 1
	}
	if opts.Concurrency <= 0 {
		opts.Concurrency = 1
	}

	conn, err := rabbitmq.NewConn(
		opts.URL,
		rabbitmq.WithConnectionOptionsLogging,
		rabbitmq.WithConnectionOptionsReconnectInterval(5*time.Second),
	)
	if err != nil {
		return nil, fmt.Errorf("queue: create connection: %w", err)
	}

	consumer, err := rabbitmq.NewConsumer(
		conn,
		opts.QueueName,
		rabbitmq.WithConsumerOptionsLogging,
		rabbitmq.WithConsumerOptionsQueueDurable,
		rabbitmq.WithConsumerOptionsQOSPrefetch(opts.Prefetch),
		rabbitmq.WithConsumerOptionsConcurrency(opts.Concurrency),
	)
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("queue: create consumer: %w", err)
	}

	return &RabbitMQConsumer{
		queue:    opts.QueueName,
		conn:     conn,
		consumer: consumer,
	}, nil
}

// Consume listens for messages until the context is cancelled or an error occurs.
func (r *RabbitMQConsumer) Consume(ctx context.Context, handler MessageHandler) error {
	if handler == nil {
		return errors.New("queue: message handler is nil")
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	defer func() {
		if err := r.Close(); err != nil {
			slog.Error("failed to close rabbitmq consumer", "error", err)
		}
	}()

	go func() {
		<-ctx.Done()
		r.consumer.Close()
	}()

	slog.Info("rabbitmq consumer started", "queue", r.queue)
	return r.consumer.Run(func(d rabbitmq.Delivery) rabbitmq.Action {
		if ctx.Err() != nil {
			return rabbitmq.NackRequeue
		}

		if err := handler(ctx, d.Body); err != nil {
			slog.Error("failed to process message", "queue", r.queue, "error", err)
			return rabbitmq.NackRequeue
		}

		return rabbitmq.Ack
	})
}

// Close releases the underlying resources.
func (r *RabbitMQConsumer) Close() error {
	if r.consumer != nil {
		r.consumer.Close()
	}
	if r.conn != nil {
		return r.conn.Close()
	}
	return nil
}
