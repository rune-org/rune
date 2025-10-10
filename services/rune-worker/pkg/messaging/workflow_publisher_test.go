package messaging

import (
	"testing"
)

func TestNewWorkflowPublisher(t *testing.T) {
	tests := []struct {
		name      string
		rabbitURL string
		wantErr   bool
	}{
		{
			name:      "empty URL",
			rabbitURL: "",
			wantErr:   true,
		},
		// Note: We can't test valid URLs without a running RabbitMQ instance
		// These tests verify the validation logic only
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pub, err := NewWorkflowPublisher(tt.rabbitURL)
			if tt.wantErr {
				if err == nil {
					t.Error("NewWorkflowPublisher() expected error, got nil")
				}
				return
			}
			// For valid URLs, we'd get connection errors without RabbitMQ
			// so we just verify the error handling works
			if pub != nil {
				defer pub.Close()
			}
		})
	}
}

func TestWorkflowPublisherClose(t *testing.T) {
	// Test that Close doesn't panic with nil publisher
	pub := &WorkflowPublisher{
		publisher: nil,
	}

	err := pub.Close()
	if err != nil {
		t.Errorf("Close() with nil publisher returned error: %v", err)
	}
}
