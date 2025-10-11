package queue

import (
	"context"
	"fmt"

	"github.com/wagslane/go-rabbitmq"
)

// Publisher publishes messages to RabbitMQ queues.
type Publisher interface {
	Publish(ctx context.Context, queue string, payload []byte) error
	Close() error
}

// RabbitMQPublisher wraps the go-rabbitmq publisher implementation.
type RabbitMQPublisher struct {
	conn      *rabbitmq.Conn
	publisher *rabbitmq.Publisher
}

// NewRabbitMQPublisher creates a publisher instance backed by RabbitMQ.
func NewRabbitMQPublisher(url string) (*RabbitMQPublisher, error) {
	if url == "" {
		return nil, fmt.Errorf("queue: rabbitmq url is required")
	}

	conn, err := rabbitmq.NewConn(
		url,
		rabbitmq.WithConnectionOptionsLogging,
	)
	if err != nil {
		return nil, fmt.Errorf("queue: create connection: %w", err)
	}

	publisher, err := rabbitmq.NewPublisher(
		conn,
		rabbitmq.WithPublisherOptionsLogging,
		rabbitmq.WithPublisherOptionsExchangeName("workflows"),
		rabbitmq.WithPublisherOptionsExchangeKind("topic"),
		rabbitmq.WithPublisherOptionsExchangeDurable,
		rabbitmq.WithPublisherOptionsExchangeDeclare,
	)
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("queue: create publisher: %w", err)
	}

	return &RabbitMQPublisher{
		conn:      conn,
		publisher: publisher,
	}, nil
}

// Publish sends a message to the specified queue using routing key.
func (p *RabbitMQPublisher) Publish(ctx context.Context, queue string, payload []byte) error {
	return p.publisher.Publish(
		payload,
		[]string{queue},
		rabbitmq.WithPublishOptionsContentType("application/json"),
		rabbitmq.WithPublishOptionsMandatory,
		rabbitmq.WithPublishOptionsPersistentDelivery,
		rabbitmq.WithPublishOptionsExchange("workflows"),
	)
}

// Close releases the underlying resources.
func (p *RabbitMQPublisher) Close() error {
	if p.publisher != nil {
		p.publisher.Close()
	}
	if p.conn != nil {
		return p.conn.Close()
	}
	return nil
}
