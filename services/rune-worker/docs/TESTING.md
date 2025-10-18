# Testing Guide

This guide covers all testing aspects of the Rune Workflow Worker, including unit tests, integration tests, E2E tests, and coverage reporting.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Unit Tests](#unit-tests)
- [Integration Tests](#integration-tests)
- [E2E Tests](#e2e-tests)
- [Coverage Reports](#coverage-reports)
- [CI/CD Testing](#cicd-testing)
- [Writing Tests](#writing-tests)
- [Troubleshooting](#troubleshooting)

## Overview

The test suite is organized into three layers:

1. **Unit Tests** - Fast, isolated tests for individual components
2. **Integration Tests** - Tests with real external services (RabbitMQ, Redis)
3. **E2E Tests** - Full workflow execution tests

### Test Requirements

| Test Type | RabbitMQ | Redis | Build Tag |
|-----------|----------|-------|-----------|
| Unit | ❌ | ❌ | None |
| Integration | ✅ | ✅ | `integration` |
| E2E | ✅ | ✅ | `integration` |

## Test Structure

```
rune-worker/
├── pkg/                    # Unit tests alongside source code
│   ├── core/
│   │   └── *_test.go
│   ├── executor/
│   │   └── executor_test.go
│   ├── nodes/
│   │   └── custom/
│   │       ├── http/
│   │       │   └── http_node_test.go
│   │       └── conditional/
│   │           └── conditional_node_test.go
│   └── ...
├── integration/            # Integration tests
│   ├── common_test.go
│   ├── rabbitmq_integration_test.go
│   └── redis_integration_test.go
├── e2e/                    # End-to-end tests
│   ├── workflow_e2e_test.go
│   └── conditional_e2e_test.go
├── test_utils/             # Shared test utilities
│   └── common.go
└── scripts/
    └── run_tests.py        # Test runner script
```

## Running Tests

### Using the Test Runner Script (Recommended)

The `run_tests.py` script provides a cross-platform way to run tests with automatic service management.

**Basic Usage:**

```bash
# Run unit tests
./scripts/run_tests.py unit

# Run integration tests
./scripts/run_tests.py integration

# Run E2E tests
./scripts/run_tests.py e2e

# Run all tests
./scripts/run_tests.py all
```

**With Options:**

```bash
# Verbose output
./scripts/run_tests.py unit -v

# Auto-start services (Docker required)
./scripts/run_tests.py integration --start-services

# Run with coverage
./scripts/run_tests.py unit --coverage

# Specific test pattern (integration only)
./scripts/run_tests.py integration -p TestRedis

# Custom timeout
./scripts/run_tests.py e2e -t 180

# Skip unit tests when running all
./scripts/run_tests.py all --skip-unit

# All options combined
./scripts/run_tests.py all --start-services -v
```

**Script Features:**

- ✅ Automatic service detection and startup
- ✅ Cross-platform (Windows, macOS, Linux)
- ✅ Colored output for easy reading
- ✅ Prerequisite checks (Go, Docker)
- ✅ Service health verification
- ✅ Coverage reporting

### Using Go Test Directly

**Unit Tests:**

```bash
# Run all unit tests
go test ./pkg/... ./cmd/...

# Run with verbose output
go test -v ./pkg/...

# Run specific package
go test ./pkg/executor/...

# Run specific test
go test ./pkg/executor/... -run TestExecutor

# Run with coverage
go test -cover ./pkg/...

# Generate coverage profile
go test -coverprofile=coverage.out ./pkg/...
go tool cover -html=coverage.out
```

**Integration Tests:**

```bash
# Run all integration tests
go test -v -tags=integration ./integration/...

# Run specific integration test
go test -v -tags=integration ./integration/... -run TestRabbitMQ

# With timeout
go test -v -tags=integration -timeout=60s ./integration/...
```

**E2E Tests:**

```bash
# Run all E2E tests
go test -v -tags=integration ./e2e/...

# Run specific E2E test
go test -v -tags=integration ./e2e/... -run TestWorkflowExecution

# With extended timeout
go test -v -tags=integration -timeout=120s ./e2e/...
```

## Unit Tests

Unit tests are fast, isolated tests that don't require external dependencies.

### Running Unit Tests

```bash
# All unit tests
go test ./pkg/... ./cmd/...

# Specific package
go test ./pkg/executor/...

# With race detection
go test -race ./pkg/...

# Parallel execution
go test -parallel 4 ./pkg/...

# Short mode (skip long-running tests)
go test -short ./pkg/...
```

### Unit Test Coverage

**Core Package Coverage:**

- `pkg/core` - Workflow types, nodes, edges
- `pkg/dsl` - DSL parsing and validation
- `pkg/executor` - Recursive executor logic
- `pkg/nodes` - Node registry and base implementations
- `pkg/nodes/custom/http` - HTTP node implementation
- `pkg/nodes/custom/conditional` - Conditional node logic
- `pkg/resolver` - Template resolution and interpolation

### Example Unit Test

```go
package executor

import (
    "context"
    "testing"
    "rune-worker/pkg/core"
)

func TestExecutor_ValidateWorkflow(t *testing.T) {
    tests := []struct {
        name      string
        workflow  *core.Workflow
        wantError bool
    }{
        {
            name: "valid workflow",
            workflow: &core.Workflow{
                ID:      "test_wf",
                Name:    "Test Workflow",
                Version: "1.0.0",
                Nodes:   []core.Node{/* ... */},
                Edges:   []core.Edge{/* ... */},
            },
            wantError: false,
        },
        {
            name: "missing nodes",
            workflow: &core.Workflow{
                ID:      "test_wf",
                Name:    "Test Workflow",
                Version: "1.0.0",
                Nodes:   []core.Node{},
                Edges:   []core.Edge{},
            },
            wantError: true,
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := ValidateWorkflow(tt.workflow)
            if (err != nil) != tt.wantError {
                t.Errorf("ValidateWorkflow() error = %v, wantError %v", err, tt.wantError)
            }
        })
    }
}
```

## Integration Tests

Integration tests verify the worker with real external services.

### Prerequisites

Integration tests require:

- **RabbitMQ** running on `localhost:5672`
- **Redis** running on `localhost:6379`

### Setting Up Services

**Option 1: Automatic (using test runner):**

```bash
./scripts/run_tests.py integration --start-services
```

**Option 2: Manual Docker Setup:**

```bash
# Start RabbitMQ
docker run -d --name rabbitmq-test \
  -p 5672:5672 -p 15672:15672 \
  rabbitmq:4.0-management-alpine

# Start Redis
docker run -d --name redis-test \
  -p 6379:6379 \
  redis:7-alpine

# Wait for services to be ready
sleep 15

# Run tests
go test -v -tags=integration ./integration/...

# Cleanup
docker rm -f rabbitmq-test redis-test
```

**Option 3: Use Existing Services:**

```bash
# Set connection URLs if different from defaults
export RABBITMQ_URL="amqp://guest:guest@localhost:5672/"
export REDIS_ADDR="localhost:6379"

# Run tests
go test -v -tags=integration ./integration/...
```

### Integration Test Coverage

The integration test suite covers:

**RabbitMQ Integration:**
- ✅ Message publishing to queues
- ✅ Message consumption with ACK/NACK
- ✅ Queue declaration and binding
- ✅ Exchange creation
- ✅ Connection recovery
- ✅ Message routing

**Redis Integration:**
- ✅ Context storage and retrieval
- ✅ JSON serialization/deserialization
- ✅ Key expiration
- ✅ Atomic operations (INCR)
- ✅ Connection pooling
- ✅ Error handling

**End-to-End Flows:**
- ✅ Complete workflow execution
- ✅ Node-by-node processing
- ✅ Context accumulation
- ✅ Status message publishing
- ✅ Completion message handling

### Example Integration Test

```go
//go:build integration

package integration

import (
    "context"
    "testing"
    "time"
)

func TestRabbitMQ_PublishConsume(t *testing.T) {
    // Setup
    conn, err := amqp.Dial("amqp://guest:guest@localhost:5672/")
    if err != nil {
        t.Fatalf("Failed to connect to RabbitMQ: %v", err)
    }
    defer conn.Close()
    
    ch, err := conn.Channel()
    if err != nil {
        t.Fatalf("Failed to open channel: %v", err)
    }
    defer ch.Close()
    
    // Test message publishing and consumption
    queueName := "test_queue_" + time.Now().Format("20060102150405")
    message := []byte(`{"test": "message"}`)
    
    // Publish message
    err = ch.Publish("", queueName, false, false, amqp.Publishing{
        ContentType: "application/json",
        Body:        message,
    })
    if err != nil {
        t.Fatalf("Failed to publish message: %v", err)
    }
    
    // Consume message
    msgs, err := ch.Consume(queueName, "", true, false, false, false, nil)
    if err != nil {
        t.Fatalf("Failed to consume: %v", err)
    }
    
    select {
    case msg := <-msgs:
        if string(msg.Body) != string(message) {
            t.Errorf("Received message = %s, want %s", msg.Body, message)
        }
    case <-time.After(5 * time.Second):
        t.Fatal("Timeout waiting for message")
    }
    
    // Cleanup
    ch.QueueDelete(queueName, false, false, false)
}
```

### Environment Variables for Integration Tests

| Variable | Default | Description |
|----------|---------|-------------|
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672/` | RabbitMQ connection URL |
| `REDIS_ADDR` | `localhost:6379` | Redis server address |
| `REDIS_PASSWORD` | `` | Redis password (if required) |
| `TEST_TIMEOUT` | `60s` | Default test timeout |

## E2E Tests

End-to-end tests validate complete workflow execution scenarios.

### Running E2E Tests

```bash
# All E2E tests
./scripts/run_tests.py e2e --start-services

# Or with go test
go test -v -tags=integration -timeout=120s ./e2e/...

# Specific E2E test
go test -v -tags=integration ./e2e/... -run TestConditionalWorkflow
```

### E2E Test Scenarios

**Workflow E2E Tests:**
- ✅ Simple linear workflow execution
- ✅ Multi-node workflow with dependencies
- ✅ Workflow with parameter interpolation
- ✅ Workflow with credentials

**Conditional E2E Tests:**
- ✅ Conditional branching (true path)
- ✅ Conditional branching (false path)
- ✅ Complex conditional expressions
- ✅ Nested conditionals

**Error Handling E2E Tests:**
- ✅ Error propagation
- ✅ Error edge branching
- ✅ Retry logic
- ✅ Timeout handling

### Example E2E Test

```go
//go:build integration

package e2e

import (
    "context"
    "encoding/json"
    "testing"
    "time"
    "rune-worker/pkg/core"
)

func TestConditionalWorkflow(t *testing.T) {
    // Create workflow with conditional node
    workflow := &core.Workflow{
        ID:      "conditional_test",
        Name:    "Conditional Test Workflow",
        Version: "1.0.0",
        Nodes: []core.Node{
            {
                ID:   "condition",
                Name: "CheckValue",
                Type: "conditional",
                Parameters: map[string]interface{}{
                    "condition":     "{{$input.value}} > 10",
                    "true_edge_id":  "to_high",
                    "false_edge_id": "to_low",
                },
            },
            {
                ID:   "high",
                Name: "HighValue",
                Type: "log",
                Parameters: map[string]interface{}{
                    "message": "Value is high",
                },
            },
            {
                ID:   "low",
                Name: "LowValue",
                Type: "log",
                Parameters: map[string]interface{}{
                    "message": "Value is low",
                },
            },
        },
        Edges: []core.Edge{
            {ID: "to_high", Src: "condition", Dst: "high"},
            {ID: "to_low", Src: "condition", Dst: "low"},
        },
    }
    
    // Submit workflow with value > 10
    executionID := submitWorkflow(t, workflow, map[string]interface{}{
        "value": 15,
    })
    
    // Wait for completion
    result := waitForCompletion(t, executionID, 30*time.Second)
    
    // Verify high value path was taken
    if !result.CompletedNodes["high"] {
        t.Error("Expected high value path to be executed")
    }
    if result.CompletedNodes["low"] {
        t.Error("Expected low value path to NOT be executed")
    }
}
```

## Coverage Reports

### Generating Coverage

**Unit Test Coverage:**

```bash
# Generate coverage profile
go test -coverprofile=coverage_unit.out ./pkg/... ./cmd/...

# View HTML coverage report
go tool cover -html=coverage_unit.out

# View summary
go tool cover -func=coverage_unit.out
```

**Integration Test Coverage:**

```bash
# Start services first
./scripts/run_tests.py integration --start-services &

# Generate coverage
go test -tags=integration -coverprofile=coverage_integration.out ./integration/...

# View report
go tool cover -html=coverage_integration.out
```

**Combined Coverage:**

```bash
# Run all tests with coverage
go test -coverprofile=coverage_all.out ./...
go test -tags=integration -coverprofile=coverage_integration.out ./integration/... ./e2e/...

# Merge coverage files
go tool covdata merge -i=coverage_all.out,coverage_integration.out -o=coverage_combined.out

# View combined report
go tool cover -html=coverage_combined.out
```

### Using the Test Runner for Coverage

```bash
# Unit test coverage
./scripts/run_tests.py unit --coverage

# Integration test coverage
./scripts/run_tests.py integration --coverage --start-services

# E2E test coverage
./scripts/run_tests.py e2e --coverage --start-services
```

### Coverage Goals

| Package | Target Coverage |
|---------|----------------|
| `pkg/core` | ≥ 90% |
| `pkg/executor` | ≥ 85% |
| `pkg/dsl` | ≥ 90% |
| `pkg/nodes` | ≥ 80% |
| `pkg/messaging` | ≥ 75% |
| `pkg/resolver` | ≥ 85% |

## CI/CD Testing

### GitHub Actions Configuration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests
- Release tags

**Workflow Steps:**

1. Checkout code
2. Setup Go 1.25
3. Start service containers (RabbitMQ, Redis)
4. Run unit tests
5. Run integration tests
6. Run E2E tests
7. Upload coverage reports

### Local CI Simulation

```bash
# Run tests exactly as CI does
./scripts/run_tests.py all --start-services -v

# With coverage
./scripts/run_tests.py all --start-services --coverage
```

## Writing Tests

### Test Best Practices

1. **Use table-driven tests** for multiple scenarios
2. **Name tests descriptively** - `TestExecutor_ValidateWorkflow_MissingNodes`
3. **Use subtests** with `t.Run()` for clarity
4. **Clean up resources** with `defer` or cleanup functions
5. **Use test helpers** from `test_utils` package
6. **Mock external dependencies** in unit tests
7. **Test error cases** as thoroughly as success cases
8. **Use meaningful assertions** with clear error messages

### Test Template

```go
package mypackage

import (
    "context"
    "testing"
)

func TestMyFunction(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        want    string
        wantErr bool
    }{
        {
            name:    "valid input",
            input:   "test",
            want:    "TEST",
            wantErr: false,
        },
        {
            name:    "empty input",
            input:   "",
            want:    "",
            wantErr: true,
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := MyFunction(tt.input)
            
            if (err != nil) != tt.wantErr {
                t.Errorf("MyFunction() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            
            if got != tt.want {
                t.Errorf("MyFunction() = %v, want %v", got, tt.want)
            }
        })
    }
}
```

### Using Test Utilities

```go
import "rune-worker/test_utils"

func TestWithTestUtils(t *testing.T) {
    // Create test workflow
    workflow := test_utils.CreateTestWorkflow("test_id", []string{"node1", "node2"})
    
    // Create test execution context
    execCtx := test_utils.CreateTestExecutionContext("workflow_id", "exec_id", "node1")
    
    // Your test logic
}
```

## Troubleshooting

### Tests Timing Out

**Increase timeout:**
```bash
go test -timeout=120s ./...
```

**For specific slow tests:**
```go
func TestSlowOperation(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping slow test in short mode")
    }
    // Test implementation
}
```

### Service Connection Failures

**Verify services are running:**
```bash
# RabbitMQ
docker ps | grep rabbitmq
curl http://localhost:15672

# Redis
docker ps | grep redis
redis-cli ping
```

**Check logs:**
```bash
docker logs rabbitmq-test
docker logs redis-test
```

**Use test runner with auto-start:**
```bash
./scripts/run_tests.py integration --start-services
```

### Tests Pass Locally but Fail in CI

1. **Check service startup timing** - CI may need longer wait times
2. **Verify environment variables** - Ensure all required vars are set in CI
3. **Check resource constraints** - CI may have less memory/CPU
4. **Review service health checks** - Ensure services are fully ready

### Flaky Tests

**Common causes:**
- Race conditions - Use `-race` flag to detect
- Timing dependencies - Add proper synchronization
- Shared state - Ensure test isolation
- External service delays - Add retries with backoff

**Fix strategies:**
```go
// Add retry logic
func waitForCondition(t *testing.T, condition func() bool, timeout time.Duration) {
    deadline := time.Now().Add(timeout)
    for time.Now().Before(deadline) {
        if condition() {
            return
        }
        time.Sleep(100 * time.Millisecond)
    }
    t.Fatal("Timeout waiting for condition")
}
```

## Quick Reference

```bash
# Unit tests (fast, no services required)
go test ./pkg/... ./cmd/...

# Integration tests (requires RabbitMQ + Redis)
./scripts/run_tests.py integration --start-services

# E2E tests (requires RabbitMQ + Redis)
./scripts/run_tests.py e2e --start-services

# All tests with auto-start services
./scripts/run_tests.py all --start-services -v

# Coverage report
./scripts/run_tests.py unit --coverage
go tool cover -html=coverage_unit.out

# Run specific test
go test ./pkg/executor/... -run TestExecutor -v

# Run with race detection
go test -race ./pkg/...

# Short mode (skip slow tests)
go test -short ./pkg/...
```

---

**Need Help?** Check the [Troubleshooting Guide](TROUBLESHOOTING.md) or review test examples in the codebase.
