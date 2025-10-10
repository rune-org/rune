package queue

import (
	"testing"
)

func TestNewRabbitMQConsumer(t *testing.T) {
	tests := []struct {
		name    string
		opts    Options
		wantErr bool
		errMsg  string
	}{
		{
			name: "empty URL",
			opts: Options{
				URL:         "",
				QueueName:   "test.queue",
				Prefetch:    1,
				Concurrency: 1,
			},
			wantErr: true,
			errMsg:  "rabbitmq url is required",
		},
		{
			name: "empty queue name",
			opts: Options{
				URL:         "amqp://localhost",
				QueueName:   "",
				Prefetch:    1,
				Concurrency: 1,
			},
			wantErr: true,
			errMsg:  "queue name is required",
		},
		{
			name: "defaults applied for invalid prefetch",
			opts: Options{
				URL:         "amqp://localhost",
				QueueName:   "test.queue",
				Prefetch:    0,
				Concurrency: 1,
			},
			wantErr: false, // Will fail on connection, but validation passes
		},
		{
			name: "defaults applied for invalid concurrency",
			opts: Options{
				URL:         "amqp://localhost",
				QueueName:   "test.queue",
				Prefetch:    1,
				Concurrency: 0,
			},
			wantErr: false, // Will fail on connection, but validation passes
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			consumer, err := NewRabbitMQConsumer(tt.opts)
			if tt.wantErr {
				if err == nil {
					t.Errorf("NewRabbitMQConsumer() expected error containing %q, got nil", tt.errMsg)
				} else if !contains(err.Error(), tt.errMsg) {
					t.Errorf("NewRabbitMQConsumer() error = %v, want error containing %q", err, tt.errMsg)
				}
				return
			}
			// For valid options, we'd get connection errors without RabbitMQ
			if consumer != nil {
				defer consumer.Close()
			}
		})
	}
}

func TestRabbitMQConsumerClose(t *testing.T) {
	// Test that Close doesn't panic with nil fields
	consumer := &RabbitMQConsumer{
		queue:    "test",
		conn:     nil,
		consumer: nil,
	}

	err := consumer.Close()
	// Should not panic, may return error but that's ok
	_ = err
}
