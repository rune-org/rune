# Integration Tests

This directory contains integration tests for the Rune Worker service that validate end-to-end functionality with real external dependencies (RabbitMQ, Redis).

## Prerequisites

Before running integration tests, ensure the following services are running:

1. **RabbitMQ** - Message broker for workflow execution messages
   ```bash
   docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:4.0-management-alpine
   ```

2. **Redis** - Key-value store for state management
   ```bash
   docker run -d --name redis -p 6379:6379 redis:7-alpine
   ```

Alternatively, use docker-compose from the project root:
```bash
docker-compose up -d rabbitmq redis
```

## Running Tests

### Run All Integration Tests
```bash
go test -tags=integration -v ./integration/
```

### Run Specific Test
```bash
go test -tags=integration -v -run TestNodeExecutionEndToEnd ./integration/
```

### Run with Custom Timeouts
```bash
go test -tags=integration -v ./integration/ -timeout 30s
```

## Environment Variables

The tests use the following environment variables (with defaults):

- `RABBITMQ_URL` - RabbitMQ connection URL (default: `amqp://guest:guest@localhost:5672/`)
- `REDIS_ADDR` - Redis server address (default: `localhost:6379`)

Example with custom values:
```bash
RABBITMQ_URL=amqp://user:pass@localhost:5672/ \
REDIS_ADDR=localhost:6380 \
go test -tags=integration -v ./integration/
```

## Test Coverage

### TestNodeExecutionEndToEnd
**Purpose**: Validates the complete workflow execution lifecycle

**What it tests**:
1. Publishing `NodeExecutionMessage` to `workflow.execution` queue
2. Consumer processing and node execution
3. Status message publishing to `workflow.node.status` queue
4. Completion message publishing to `workflow.completion` queue
5. HTTP node execution with external API calls
6. Context accumulation and message routing

**Expected behavior**:
- Node executes successfully with HTTP GET request
- Receives "running" status followed by "success" status
- Receives completion message with status "completed"
- Node output contains response data (body, headers, status)

### TestNodeExecutionWithMultipleNodes
**Purpose**: Tests workflow execution with chained nodes

**What it tests**:
1. Publishing workflow with multiple nodes connected by edges
2. Sequential node execution following the graph
3. Message routing between nodes
4. Context accumulation across multiple nodes

### TestNodeExecutionWithParameterResolution
**Purpose**: Validates dynamic parameter resolution from context

**What it tests**:
1. Parameter references using `$node.field` syntax
2. Context resolution during node execution
3. Accumulated context propagation

### TestRabbitMQPublishMultipleMessages
**Purpose**: Tests concurrent message publishing

**What it tests**:
1. Publishing multiple workflow messages
2. Queue handling under load
3. Message persistence

### TestRedisOperations
**Purpose**: Validates Redis connectivity and operations

**What it tests**:
1. Basic SET/GET operations
2. Counters (INCR)
3. JSON storage and retrieval
4. Key expiration

## Test Patterns

### Integration Test Setup
Each test follows this pattern:

```go
func TestSomething(t *testing.T) {
    env := setupIntegrationTest(t)
    defer env.cleanup(t)
    
    // Test logic here
}
```

The `setupIntegrationTest` helper provides:
- RabbitMQ publisher
- Redis client
- Configured logger
- Automatic cleanup

### Message Flow Testing
To test end-to-end message flow:

1. **Publish** execution message to input queue
2. **Start consumer** to process messages
3. **Monitor** status and completion queues
4. **Validate** output messages and state

## Troubleshooting

### Connection Refused
**Error**: `Failed to connect to RabbitMQ` or `Failed to connect to Redis`

**Solution**: Ensure services are running:
```bash
docker ps | grep -E 'rabbitmq|redis'
```

### Test Timeouts
**Error**: `panic: test timed out after Xs`

**Solution**: 
- Check if RabbitMQ/Redis are responsive
- Increase timeout with `-timeout` flag
- Verify network connectivity

### Queue Not Found
**Error**: Messages not being consumed

**Solution**: 
- Queues are created on-demand when consumers start
- Ensure consumer initialization completes before publishing
- Check RabbitMQ management UI at http://localhost:15672 (guest/guest)

### Race Conditions
**Error**: Flaky test results

**Solution**:
- Add appropriate sleep/wait times for async operations
- Use channels to synchronize goroutines
- Implement proper context cancellation

## CI/CD Integration

For CI environments, start dependencies before running tests:

```yaml
# Example GitHub Actions
steps:
  - name: Start RabbitMQ
    run: docker run -d -p 5672:5672 -p 15672:15672 rabbitmq:4.0-management-alpine
  
  - name: Start Redis
    run: docker run -d -p 6379:6379 redis:7-alpine
  
  - name: Wait for services
    run: sleep 5
  
  - name: Run Integration Tests
    run: go test -tags=integration -v ./integration/ -timeout 60s
```

## Best Practices

1. **Isolation**: Each test should be independent and clean up after itself
2. **Timeouts**: Always use context timeouts to prevent hanging tests
3. **Logging**: Use `t.Log()` to provide visibility into test execution
4. **Cleanup**: Use `defer` for cleanup operations
5. **Validation**: Assert both success cases and expected outputs
6. **Real Dependencies**: Use actual RabbitMQ/Redis, not mocks

## Known Issues

1. **Cleanup Timeout**: Some tests may timeout during cleanup due to RabbitMQ connection pool draining. This is a known issue with the go-rabbitmq library and doesn't affect test validation.

2. **Concurrent Tests**: Running integration tests in parallel may cause resource contention. Use `-p 1` flag to run sequentially if needed.

## Further Reading

- [RFC-001: Recursive Executor](../rfcs/RFC-001-recursive-executor.md)
- [RFC-002: Workflow DSL](../rfcs/RFC-002-workflow-dsl.md)
- [RabbitMQ Flow Diagram](../docs/RABBITMQ_FLOW_DIAGRAM.md)
