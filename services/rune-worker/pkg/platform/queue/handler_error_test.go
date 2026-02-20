package queue

import (
	"errors"
	"fmt"
	"testing"
)

func TestShouldRetry(t *testing.T) {
	t.Parallel()

	base := errors.New("base")

	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "nil error",
			err:  nil,
			want: false,
		},
		{
			name: "unclassified defaults to retryable",
			err:  base,
			want: true,
		},
		{
			name: "explicit retryable",
			err:  Retryable(base),
			want: true,
		},
		{
			name: "explicit non-retryable",
			err:  NonRetryable(base),
			want: false,
		},
		{
			name: "wrapped non-retryable",
			err:  fmt.Errorf("wrapped: %w", NonRetryable(base)),
			want: false,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := ShouldRetry(tt.err)
			if got != tt.want {
				t.Fatalf("ShouldRetry() = %v, want %v", got, tt.want)
			}
		})
	}
}
