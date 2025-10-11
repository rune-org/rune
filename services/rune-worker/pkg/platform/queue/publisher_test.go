package queue

import (
	"testing"
)

func TestNewRabbitMQPublisher(t *testing.T) {
	tests := []struct {
		name    string
		url     string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "empty URL",
			url:     "",
			wantErr: true,
			errMsg:  "rabbitmq url is required",
		},
		// Note: We can't test valid URLs without a running RabbitMQ instance
		// These tests verify the validation logic only
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pub, err := NewRabbitMQPublisher(tt.url)
			if tt.wantErr {
				if err == nil {
					t.Errorf("NewRabbitMQPublisher() expected error containing %q, got nil", tt.errMsg)
				} else if !contains(err.Error(), tt.errMsg) {
					t.Errorf("NewRabbitMQPublisher() error = %v, want error containing %q", err, tt.errMsg)
				}
				return
			}
			// For valid URLs, we'd get connection errors without RabbitMQ
			if pub != nil {
				defer func() {
					_ = pub.Close()
				}()
			}
		})
	}
}

func TestRabbitMQPublisherClose(t *testing.T) {
	// Test that Close doesn't panic with nil fields
	pub := &RabbitMQPublisher{
		conn:      nil,
		publisher: nil,
	}

	err := pub.Close()
	// Should not panic, may return error but that's ok
	_ = err
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > 0 && len(substr) > 0 && indexOf(s, substr) >= 0))
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
