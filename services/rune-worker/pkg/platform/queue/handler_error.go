package queue

import "errors"

// RetryClassifiedError marks whether a handler error should be retried (requeued)
// or discarded (and optionally dead-lettered by RabbitMQ policy).
type RetryClassifiedError interface {
	error
	Retryable() bool
}

type handlerError struct {
	err       error
	retryable bool
}

func (e *handlerError) Error() string {
	if e == nil || e.err == nil {
		return ""
	}
	return e.err.Error()
}

func (e *handlerError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.err
}

func (e *handlerError) Retryable() bool {
	if e == nil {
		return true
	}
	return e.retryable
}

// Retryable wraps an error as retryable so the message is requeued.
func Retryable(err error) error {
	if err == nil {
		return nil
	}
	return &handlerError{err: err, retryable: true}
}

// NonRetryable wraps an error as non-retryable so the message is discarded.
func NonRetryable(err error) error {
	if err == nil {
		return nil
	}
	return &handlerError{err: err, retryable: false}
}

// ShouldRetry returns true if the message should be requeued.
// Unclassified errors default to retryable for backward compatibility.
func ShouldRetry(err error) bool {
	if err == nil {
		return false
	}

	var classified RetryClassifiedError
	if errors.As(err, &classified) {
		return classified.Retryable()
	}

	return true
}
