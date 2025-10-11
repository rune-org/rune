# Integration Tests

This directory contains integration tests for the Rune Worker service that validate the system's interaction with external dependencies like RabbitMQ and Redis.

## Test Files

The integration tests are organized into separate files by concern:

- **`common_test.go`** - Wrapper functions for shared test utilities (imports from `test_utils` package)
  - `setupIntegrationTest()` - Wrapper for `testutils.SetupTestEnv()`
  - `getKeys()` - Wrapper for `testutils.GetKeys()`
  - See [Test Utils](../test_utils/README.md) for shared infrastructure

- **`rabbitmq_integration_test.go`** - RabbitMQ-specific tests (5 tests)
  - `TestPublishToRabbitMQ` - Basic message publishing
  - `TestWorkflowWithConfig` - Consumer configuration validation
  - `TestRabbitMQPublishMultipleMessages` - Publishing multiple messages
  - `TestNodeExecutionWithMultipleNodes` - Multi-node workflow execution
  - `TestNodeExecutionWithParameterResolution` - Dynamic parameter resolution

- **`redis_integration_test.go`** - Redis-specific tests (1 test with 4 subtests)
  - `TestRedisOperations` - Comprehensive Redis operation tests
    - SET and GET operations
    - INCR counter operations
    - JSON storage and retrieval
    - Key expiration

## Prerequisites

Before running integration tests, ensure the following services are running:

### 1. RabbitMQ
Message broker for workflow execution messages:

```bash
docker run -d --name rabbitmq-test \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:4.0-management-alpine
```

Access RabbitMQ Management UI at: http://localhost:15672 (guest/guest)

### 2. Redis
Key-value store for state management:

```bash
docker run -d --name redis-test \
  -p 6379:6379 \
  redis:7-alpine
```

### Using Docker Compose

Alternatively, use docker-compose from the project root:

```bash
docker-compose up -d rabbitmq redis
```

## Running Tests

### Run All Integration Tests

```bash
# From the rune-worker directory
go test -tags=integration -v ./integration/
```

### Run Specific Test Files

**RabbitMQ tests only:**
```bash
go test -tags=integration -v ./integration/ -run "TestPublishToRabbitMQ|TestRabbitMQ|TestNodeExecution|TestWorkflowWithConfig"
```

**Redis tests only:**
```bash
go test -tags=integration -v ./integration/ -run TestRedisOperations
```

### Run Specific Tests

**Single test:**
```bash
go test -tags=integration -v ./integration/ -run TestPublishToRabbitMQ
```

**Specific Redis subtest:**
```bash
go test -tags=integration -v ./integration/ -run "TestRedisOperations/SET_and_GET"
```

**Multi-node workflow test:**
```bash
go test -tags=integration -v ./integration/ -run TestNodeExecutionWithMultipleNodes
```

### Run with Timeout

```bash
go test -tags=integration -v ./integration/ -timeout 60s
```

### Run with Coverage

```bash
go test -tags=integration -v ./integration/ -cover -coverprofile=coverage.out
go tool cover -html=coverage.out
```

## Environment Variables

You can customize the test environment using these variables:

- `RABBITMQ_URL` - RabbitMQ connection URL (default: `amqp://guest:guest@localhost:5672/`)
- `REDIS_ADDR` - Redis address (default: `localhost:6379`)

Example:
```bash
RABBITMQ_URL="amqp://admin:password@rabbitmq.example.com:5672/" \
REDIS_ADDR="redis.example.com:6379" \
go test -tags=integration -v ./integration/
```

## Test Output

Integration tests produce detailed logs including:
- Message publishing confirmations
- Workflow execution status
- Redis operation results
- Error messages and stack traces

Example output:
```
=== RUN   TestPublishToRabbitMQ
    rabbitmq_integration_test.go:59: Successfully published node execution message to RabbitMQ
--- PASS: TestPublishToRabbitMQ (0.02s)
```

## Troubleshooting

### Connection Errors

**RabbitMQ connection failed:**
```bash
# Check if RabbitMQ is running
docker ps | grep rabbitmq

# Check RabbitMQ logs
docker logs rabbitmq-test

# Verify RabbitMQ is accessible
curl http://localhost:15672/api/overview -u guest:guest
```

**Redis connection failed:**
```bash
# Check if Redis is running
docker ps | grep redis

# Test Redis connection
docker exec redis-test redis-cli ping
# Should return: PONG
```

### Queue Issues

If tests fail with message consumption errors, you may need to purge queues:

```bash
# Purge workflow execution queue
docker exec rabbitmq-test rabbitmqctl purge_queue workflow.execution

# Purge status queue
docker exec rabbitmq-test rabbitmqctl purge_queue workflow.node.status

# Purge completion queue
docker exec rabbitmq-test rabbitmqctl purge_queue workflow.completion

# List all queues
docker exec rabbitmq-test rabbitmqctl list_queues
```

### Redis Issues

Clear Redis data if tests are interfering with each other:

```bash
# Flush Redis database
docker exec redis-test redis-cli FLUSHDB

# Or flush all databases
docker exec redis-test redis-cli FLUSHALL
```

### Port Conflicts

If ports are already in use:

```bash
# Check what's using the ports
lsof -i :5672   # RabbitMQ
lsof -i :15672  # RabbitMQ Management
lsof -i :6379   # Redis

# Stop conflicting containers
docker stop $(docker ps -q --filter "publish=5672")
docker stop $(docker ps -q --filter "publish=6379")
```

## Test Architecture

### RabbitMQ Tests

Tests validate message publishing, consumption, and workflow execution:

```
NodeExecutionMessage → RabbitMQ (workflow.execution)
    ↓
WorkflowConsumer picks up message
    ↓
Executor processes node
    ↓
Status updates → RabbitMQ (workflow.node.status)
    ↓
Completion message → RabbitMQ (workflow.completion)
```

### Redis Tests

Tests validate key-value operations used for state management:
- Simple string SET/GET operations
- Atomic counter increments (INCR)
- JSON object storage and retrieval
- TTL and key expiration

## Build Tags

All integration tests use the `integration` build tag to:
- Prevent them from running with standard unit tests
- Allow selective execution requiring external dependencies
- Enable longer timeout allowances for real service interactions

To run tests without the integration tag:
```bash
go test ./integration/  # Will skip all tests
```

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    
    services:
      rabbitmq:
        image: rabbitmq:4.0-management-alpine
        ports:
          - 5672:5672
          - 15672:15672
      
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Run Integration Tests
        run: |
          cd services/rune-worker
          go test -tags=integration -v ./integration/ -timeout 5m
```

## Additional Resources

- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [Redis Documentation](https://redis.io/documentation)
- [Go Testing Documentation](https://pkg.go.dev/testing)
- [E2E Tests](../e2e/README.md) - For comprehensive end-to-end workflow tests
