# End-to-End Tests

This directory contains comprehensive end-to-end tests that validate complete workflow execution through the entire system stack.

## Overview

E2E tests validate the full message flow and processing lifecycle:
1. Message publishing to RabbitMQ
2. Consumer message processing
3. Node execution with real implementations
4. Status reporting and validation
5. Workflow completion messaging

## Test Infrastructure

E2E tests use shared test utilities from the `test_utils` package. See [Test Utils](../test_utils/README.md) for details on:
- Test environment setup (`SetupTestEnv`)
- Resource cleanup (`Cleanup`)
- Helper functions (`GetKeys`)

## Running E2E Tests

### Prerequisites

Ensure the following services are running:

```bash
# Start RabbitMQ
docker run -d --name rabbitmq-test \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:4.0-management-alpine

# Start Redis
docker run -d --name redis-test \
  -p 6379:6379 \
  redis:7-alpine
```

### Run Tests

From the `services/rune-worker` directory:

```bash
# Run all E2E tests
go test -v -tags=integration ./e2e/...

# Run specific test
go test -v -tags=integration ./e2e -run TestNodeExecutionEndToEnd

# Run with timeout
go test -v -tags=integration -timeout 60s ./e2e/...
```

### Environment Variables

- `RABBITMQ_URL`: RabbitMQ connection URL (default: `amqp://guest:guest@localhost:5672/`)
- `REDIS_ADDR`: Redis address (default: `localhost:6379`)

## Test Output

E2E tests produce detailed logs including:
- HTTP response status and status text
- All response headers in JSON format
- Complete response body
- Request duration in milliseconds
- Workflow completion status

Example output:
```
=== Node Execution Output (from status message) ===
  - HTTP Status: 200
  - HTTP Status Text: 200 OK
  - Request Duration: 1102 ms
  - Response Headers (7 total):
    {
      "Connection": "keep-alive",
      "Content-Length": "53",
      "Content-Type": "application/json",
      ...
    }
  - Response Body (53 bytes):
    {"uuid": "ed695f7b-221e-48f9-a528-e0f8eef5d8f5"}
================================================
```

## Troubleshooting

### Cleanup Timeout

You may see a timeout error during test cleanup:
```
Failed to close consumer: context deadline exceeded
```

This is a known issue with the go-rabbitmq library and does not affect test validation. All assertions pass before cleanup runs.

### Queue Purging

If tests fail with "current_node is required" error, old messages may be in the queue:

```bash
# Purge the execution queue
docker exec rabbitmq-test rabbitmqctl purge_queue workflow.execution

# Purge status queue
docker exec rabbitmq-test rabbitmqctl purge_queue workflow.node.status

# Purge completion queue
docker exec rabbitmq-test rabbitmqctl purge_queue workflow.completion
```

### Connection Errors

Ensure RabbitMQ and Redis are running and accessible:

```bash
# Check RabbitMQ
curl http://localhost:15672/api/overview -u guest:guest

# Check Redis
docker exec redis-test redis-cli ping
```

## Test Coverage

- **TestNodeExecutionEndToEnd**: Complete workflow lifecycle with HTTP node
  - Validates message publishing and routing
  - Verifies consumer processing and node execution
  - Checks status messages (running → success)
  - Validates completion message
  - Logs detailed execution output

## Architecture

The E2E test validates the complete message flow:

```
NodeExecutionMessage → RabbitMQ (workflow.execution)
    ↓
WorkflowConsumer picks up message
    ↓
Executor processes node
    ↓
Status messages → RabbitMQ (workflow.node.status)
    ↓
Completion message → RabbitMQ (workflow.completion)
```

## Build Tags

All E2E tests use the `integration` build tag to prevent them from running with standard unit tests. This allows for:
- Isolation from fast unit tests
- Controlled execution requiring external dependencies
- Longer timeout allowances for real service interactions
