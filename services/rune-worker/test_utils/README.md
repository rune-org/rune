# Test Utilities

This directory contains shared test utilities and helpers used across integration and E2E tests.

## Overview

The `testutils` package provides common setup, teardown, and helper functions to avoid code duplication across different test suites.

## Contents

### `common.go`

Shared test infrastructure for integration and E2E tests.

#### Constants

- **`DefaultRabbitMQURL`** - Default RabbitMQ connection URL (`amqp://guest:guest@localhost:5672/`)
- **`DefaultRedisAddr`** - Default Redis address (`localhost:6379`)
- **`TestTimeout`** - Default test timeout (30 seconds)

#### Types

**`TestEnv`** - Test environment struct containing:
- `RedisClient` - Redis client for state management
- `Publisher` - RabbitMQ publisher for message publishing
- `Logger` - Structured logger (slog)
- `RabbitMQURL` - RabbitMQ connection URL

#### Functions

**`SetupTestEnv(t *testing.T) *TestEnv`**
- Creates a complete test environment with RabbitMQ and Redis connections
- Validates connections before returning
- Automatically marks test as failed if setup fails
- Should be called at the start of each test

**`(*TestEnv) Cleanup(t *testing.T)`**
- Cleans up test resources
- Flushes Redis database
- Closes all connections
- Should be deferred immediately after setup

**`GetEnvOrDefault(key, defaultValue string) string`**
- Returns environment variable value or default if not set
- Used for configuring test connections

**`GetKeys(m map[string]interface{}) []string`**
- Extracts and returns all keys from a map
- Useful for logging and debugging test data

## Usage

### In Integration Tests

```go
//go:build integration

package integration

import (
    "testing"
    testutils "rune-worker/test_utils"
)

func TestSomething(t *testing.T) {
    env := testutils.SetupTestEnv(t)
    defer env.Cleanup(t)
    
    // Use env.Publisher, env.RedisClient, etc.
    err := env.Publisher.Publish(ctx, "queue.name", msgBytes)
    // ...
}
```

### In E2E Tests

```go
//go:build integration

package e2e

import (
    "testing"
    testutils "rune-worker/test_utils"
)

func TestEndToEnd(t *testing.T) {
    env := testutils.SetupTestEnv(t)
    defer env.Cleanup(t)
    
    // Use shared test environment
    // ...
}
```

### With Wrapper Functions

Tests can create wrapper functions to maintain backward compatibility or add test-specific setup:

```go
func setupIntegrationTest(t *testing.T) *testutils.TestEnv {
    return testutils.SetupTestEnv(t)
}

func getKeys(m map[string]interface{}) []string {
    return testutils.GetKeys(m)
}
```

## Environment Variables

The test utilities respect the following environment variables:

- **`RABBITMQ_URL`** - Override default RabbitMQ URL
- **`REDIS_ADDR`** - Override default Redis address

Example:
```bash
RABBITMQ_URL="amqp://admin:password@rabbitmq.example.com:5672/" \
REDIS_ADDR="redis.example.com:6379" \
go test -tags=integration -v ./integration/
```

## Design Principles

1. **No Build Tags** - The test_utils package has no build tags so it can be imported by any test
2. **Exported Names** - All public types and functions use exported (capitalized) names
3. **Fail Fast** - Setup functions fail the test immediately if connections cannot be established
4. **Clean Separation** - No test logic, only infrastructure setup and utilities
5. **Reusability** - Functions are generic enough to be used across different test types

## Dependencies

- `github.com/redis/go-redis/v9` - Redis client
- `rune-worker/pkg/platform/queue` - RabbitMQ publisher interface

## Benefits

✅ **Reduces code duplication** - Single source of truth for test setup
✅ **Consistent behavior** - All tests use the same setup logic
✅ **Easier maintenance** - Changes to setup logic only need to be made once
✅ **Better testing** - More time writing tests, less time on boilerplate
✅ **Shared across test types** - Integration and E2E tests use the same utilities

## Related Documentation

- [Integration Tests](../integration/README.md) - Integration test documentation
- [E2E Tests](../e2e/README.md) - End-to-end test documentation
