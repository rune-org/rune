package messaging

import (
	"testing"

	"rune-worker/pkg/platform/config"
)

func TestNewWorkflowConsumer(t *testing.T) {
	tests := []struct {
		name    string
		cfg     *config.WorkerConfig
		wantErr bool
		errMsg  string
	}{
		{
			name:    "nil config",
			cfg:     nil,
			wantErr: true,
			errMsg:  "config is nil",
		},
		// Note: We can't test valid configs without a running RabbitMQ instance
		// These tests verify the validation logic only
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			consumer, err := NewWorkflowConsumer(tt.cfg, nil)
			if tt.wantErr {
				if err == nil {
					t.Errorf("NewWorkflowConsumer() expected error containing %q, got nil", tt.errMsg)
				} else if !contains(err.Error(), tt.errMsg) {
					t.Errorf("NewWorkflowConsumer() error = %v, want error containing %q", err, tt.errMsg)
				}
				return
			}
			// For valid configs, we'd get connection errors without RabbitMQ
			if consumer != nil {
				defer func() {
					_ = consumer.Close()
				}()
			}
		})
	}
}

func TestWorkflowConsumerClose(t *testing.T) {
	// Test that Close doesn't panic with nil fields
	consumer := &WorkflowConsumer{
		queue:    nil,
		executor: nil,
	}

	err := consumer.Close()
	// Should not panic, error is acceptable
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
