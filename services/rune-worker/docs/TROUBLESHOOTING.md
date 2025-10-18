# Troubleshooting Guide

Common issues and solutions for the Rune Workflow Worker.

## Table of Contents

- [Worker Issues](#worker-issues)
- [Connection Issues](#connection-issues)
- [Workflow Execution Issues](#workflow-execution-issues)
- [Node-Specific Issues](#node-specific-issues)
- [Performance Issues](#performance-issues)
- [Debugging Techniques](#debugging-techniques)

## Worker Issues

### Worker Won't Start

**Symptom**: Worker exits immediately or fails to start

**Common Causes:**

1. **Missing dependencies**
   ```bash
   # Check if RabbitMQ is running
   docker ps | grep rabbitmq
   # Or
   systemctl status rabbitmq-server
   
   # Check if Redis is running
   docker ps | grep redis
   # Or
   systemctl status redis-server
   ```

2. **Invalid configuration**
   ```bash
   # Verify environment variables
   env | grep RABBITMQ
   env | grep REDIS
   
   # Check config file syntax
   cat config.yaml
   ```

3. **Port conflicts**
   ```bash
   # Check if ports are in use
   lsof -i :5672  # RabbitMQ
   lsof -i :6379  # Redis
   ```

**Solutions:**

```bash
# Start dependencies with Docker
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:4.0-management-alpine
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Verify configuration
./worker --config config.yaml --validate

# Check logs for specific errors
tail -f worker.log
```

### Worker Crashes Unexpectedly

**Symptom**: Worker running but crashes randomly

**Common Causes:**

1. **Out of memory**
   ```bash
   # Check memory usage
   docker stats rune-worker
   # Or
   ps aux | grep worker
   ```

2. **Panic in node execution**
   ```bash
   # Check logs for panic traces
   grep -i "panic" worker.log
   ```

3. **Connection loss to services**
   ```bash
   # Check service health
   docker logs rabbitmq
   docker logs redis
   ```

**Solutions:**

```bash
# Increase memory limits (Docker)
docker run -m 512m rune-worker

# Add panic recovery in custom nodes
defer func() {
    if r := recover(); r != nil {
        slog.Error("panic recovered", "error", r)
    }
}()

# Enable debug logging
LOG_LEVEL=debug ./worker
```

## Connection Issues

### RabbitMQ Connection Failures

**Symptom**: `Failed to connect to RabbitMQ` errors

**Diagnosis:**

```bash
# Test RabbitMQ connectivity
telnet localhost 5672

# Check RabbitMQ status
rabbitmqctl status

# View RabbitMQ logs
docker logs rabbitmq

# Test with curl (management API)
curl -u guest:guest http://localhost:15672/api/overview
```

**Solutions:**

1. **Verify RabbitMQ is running**
   ```bash
   docker start rabbitmq
   # Or
   systemctl start rabbitmq-server
   ```

2. **Check connection URL**
   ```bash
   # Correct format
   export RABBITMQ_URL="amqp://guest:guest@localhost:5672/"
   
   # With vhost
   export RABBITMQ_URL="amqp://user:pass@host:5672/vhost"
   ```

3. **Check firewall rules**
   ```bash
   # Allow RabbitMQ port
   sudo ufw allow 5672
   ```

4. **Verify credentials**
   ```bash
   # List users
   rabbitmqctl list_users
   
   # Add user if needed
   rabbitmqctl add_user worker password
   rabbitmqctl set_permissions -p / worker ".*" ".*" ".*"
   ```

### Redis Connection Failures

**Symptom**: `Failed to connect to Redis` errors

**Diagnosis:**

```bash
# Test Redis connectivity
redis-cli -h localhost -p 6379 ping
# Expected: PONG

# Check Redis status
redis-cli info server

# View Redis logs
docker logs redis
```

**Solutions:**

1. **Verify Redis is running**
   ```bash
   docker start redis
   # Or
   systemctl start redis-server
   ```

2. **Check connection string**
   ```bash
   # Correct format
   export REDIS_ADDR="localhost:6379"
   
   # With password
   export REDIS_PASSWORD="your_password"
   ```

3. **Test with redis-cli**
   ```bash
   # Without password
   redis-cli -h localhost -p 6379
   
   # With password
   redis-cli -h localhost -p 6379 -a your_password
   ```

## Workflow Execution Issues

### Workflows Not Processing

**Symptom**: Messages in queue but not being processed

**Diagnosis:**

```bash
# Check queue status
rabbitmqctl list_queues name messages consumers

# View messages in queue (RabbitMQ Management UI)
open http://localhost:15672/#/queues

# Check worker logs
tail -f worker.log | grep "processing"
```

**Common Causes:**

1. **No consumers connected**
   - Worker not running
   - Consumer configuration incorrect

2. **Message format invalid**
   - Missing required fields
   - Invalid JSON

3. **Worker busy/blocked**
   - Long-running operation
   - Deadlock

**Solutions:**

```bash
# Verify worker is consuming
rabbitmqctl list_consumers

# Check worker concurrency settings
export WORKFLOW_CONCURRENCY=5

# Restart worker
docker restart rune-worker

# Purge queue if messages are corrupted
rabbitmqctl purge_queue workflow.execution
```

### Workflows Stuck in "Running" State

**Symptom**: Workflow starts but never completes

**Diagnosis:**

```bash
# Check Redis for execution state
redis-cli keys "workflow:*"
redis-cli get "workflow:exec_123:context"

# Check for error messages
grep "exec_123" worker.log

# View RabbitMQ queues for pending messages
rabbitmqctl list_queues
```

**Common Causes:**

1. **Node execution failure** without proper error handling
2. **Missing edges** in workflow definition
3. **Worker crash** during execution

**Solutions:**

```bash
# Check workflow definition
cat workflow.json | jq .

# Validate all edges have destination nodes
# Ensure error handling is configured

# Check for orphaned executions in Redis
redis-cli keys "workflow:*" | xargs redis-cli del

# Re-submit workflow
```

### Nodes Execute Multiple Times

**Symptom**: Same node executes twice or more

**Common Causes:**

1. **Message nack and redelivery**
2. **Multiple workers processing same message**
3. **Worker crash before ACK**

**Solutions:**

```bash
# Check message acknowledgment in logs
grep "acknowledged" worker.log

# Ensure only one worker per queue or use different consumers
WORKFLOW_CONCURRENCY=1 ./worker

# Add idempotency to nodes
# Store execution ID in Redis to detect duplicates
```

## Node-Specific Issues

### HTTP Node Failures

**Symptom**: HTTP requests fail or timeout

**Diagnosis:**

```bash
# Test endpoint manually
curl -v https://api.example.com/endpoint

# Check DNS resolution
nslookup api.example.com

# Test connectivity
ping api.example.com
```

**Solutions:**

1. **Increase timeout**
   ```json
   {
     "parameters": {
       "timeout": 60
     }
   }
   ```

2. **Add retry logic**
   ```json
   {
     "parameters": {
       "retry": 3,
       "retry_delay": 2000
     }
   }
   ```

3. **Check SSL certificate**
   ```json
   {
     "parameters": {
       "ignore_ssl": true
     }
   }
   ```

4. **Verify authentication**
   ```json
   {
     "parameters": {
       "headers": {
         "Authorization": "Bearer {{$credential.token}}"
       }
     },
     "credentials": {
       "source": "api_credentials"
     }
   }
   ```

### Conditional Node Not Branching Correctly

**Symptom**: Wrong branch taken or error evaluating condition

**Diagnosis:**

```bash
# Check logs for condition evaluation
grep "conditional" worker.log | grep "evaluation"

# Verify context contains expected data
redis-cli get "workflow:exec_123:context" | jq .
```

**Solutions:**

1. **Verify condition syntax**
   ```json
   {
     "condition": "{{$fetch_user.body.status}} == 'active'"
   }
   ```

2. **Check field exists**
   - Ensure previous node outputs the required field
   - Verify field path is correct

3. **Type matching**
   - String comparisons need quotes: `'active'`
   - Number comparisons don't: `> 100`
   - Boolean comparisons: `== true`

4. **Debug with log node**
   ```json
   {
     "id": "debug_log",
     "type": "log",
     "parameters": {
       "message": "User status: {{$fetch_user.body.status}}"
     }
   }
   ```

### Template Interpolation Failures

**Symptom**: `{{$var}}` not replaced or errors

**Diagnosis:**

```bash
# Check context data
redis-cli get "workflow:exec_123:context" | jq .

# Look for interpolation errors in logs
grep "interpolation" worker.log
grep "template" worker.log
```

**Solutions:**

1. **Verify field path**
   ```json
   // Correct
   "{{$fetch_user.body.name}}"
   
   // Incorrect
   "{{$fetch_user.name}}"  // Missing .body
   ```

2. **Check node executed**
   - Referenced node must have already executed
   - Node ID must match exactly

3. **Handle missing fields**
   - Add default values
   - Use conditional logic

## Performance Issues

### Slow Workflow Execution

**Symptom**: Workflows take longer than expected

**Diagnosis:**

```bash
# Check node execution times in logs
grep "duration_ms" worker.log

# Monitor system resources
top
docker stats

# Check network latency
ping api.example.com
```

**Solutions:**

1. **Reduce HTTP timeouts**
   ```json
   {"timeout": 10}  // Instead of 30
   ```

2. **Increase worker concurrency**
   ```bash
   export WORKFLOW_CONCURRENCY=10
   ```

3. **Add more workers**
   ```bash
   docker-compose scale rune-worker=5
   ```

4. **Optimize HTTP requests**
   - Remove unnecessary headers
   - Minimize request/response size
   - Use compression

### High Memory Usage

**Symptom**: Worker consuming excessive memory

**Diagnosis:**

```bash
# Check memory usage
docker stats rune-worker
ps aux | grep worker

# Look for memory leaks
go tool pprof http://localhost:6060/debug/pprof/heap
```

**Solutions:**

1. **Reduce context size**
   - Limit output from nodes
   - Clean up unnecessary data

2. **Increase garbage collection**
   ```bash
   GOGC=20 ./worker
   ```

3. **Set memory limits**
   ```yaml
   # docker-compose.yml
   services:
     rune-worker:
       mem_limit: 512m
   ```

### Message Queue Buildup

**Symptom**: Messages accumulating in queues

**Diagnosis:**

```bash
# Check queue depths
rabbitmqctl list_queues name messages

# Monitor consumption rate
watch -n 1 'rabbitmqctl list_queues name messages'
```

**Solutions:**

1. **Add more workers**
   ```bash
   docker-compose scale rune-worker=5
   ```

2. **Increase prefetch**
   ```bash
   export WORKFLOW_PREFETCH=20
   ```

3. **Increase concurrency**
   ```bash
   export WORKFLOW_CONCURRENCY=10
   ```

4. **Optimize slow nodes**
   - Reduce timeouts
   - Parallelize when possible

## Debugging Techniques

### Enable Debug Logging

```bash
# Set log level
export LOG_LEVEL=debug

# Or in config
LOG_LEVEL=debug ./worker

# View specific components
grep "executor" worker.log
grep "http_node" worker.log
```

### Inspect Messages

```bash
# View message in queue (RabbitMQ Management UI)
# http://localhost:15672/#/queues/%2F/workflow.execution

# Get single message without removing
rabbitmqctl list_queues name messages

# Consume one message for inspection
# Use RabbitMQ Management UI "Get messages" feature
```

### Check Context Data

```bash
# List all workflow contexts in Redis
redis-cli keys "workflow:*"

# View specific context
redis-cli get "workflow:exec_123:context" | jq .

# Delete corrupted context
redis-cli del "workflow:exec_123:context"
```

### Trace Execution Flow

```bash
# Follow execution in logs
tail -f worker.log | grep "exec_123"

# See all node executions
grep "executing node" worker.log

# See all status publications
grep "publishing status" worker.log
```

### Test Individual Nodes

```go
// Create test for specific node
func TestHTTPNode_RealAPI(t *testing.T) {
    if testing.Short() {
        t.Skip()
    }
    
    execCtx := plugin.ExecutionContext{
        NodeID: "test",
        Type:   "http",
        Parameters: map[string]interface{}{
            "method": "GET",
            "url":    "https://api.example.com/test",
        },
        Input: make(map[string]interface{}),
    }
    
    node := NewHTTPNode(execCtx)
    output, err := node.Execute(context.Background(), execCtx)
    
    // Inspect output
    t.Logf("Output: %+v", output)
    t.Logf("Error: %v", err)
}
```

### Use Test Workflows

Create simple test workflows to isolate issues:

```json
{
  "id": "debug_workflow",
  "name": "Debug Workflow",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "log1",
      "type": "log",
      "parameters": {
        "message": "Input data: {{$input}}"
      }
    }
  ],
  "edges": []
}
```

## Getting Help

### Collect Information

When reporting issues, include:

1. **Worker logs**
   ```bash
   tail -n 200 worker.log > issue_logs.txt
   ```

2. **Configuration**
   ```bash
   env | grep -E "(RABBITMQ|REDIS|WORKFLOW)" > config.txt
   ```

3. **Workflow definition**
   ```bash
   cat workflow.json
   ```

4. **System information**
   ```bash
   go version
   docker version
   uname -a
   ```

5. **Service status**
   ```bash
   docker ps
   rabbitmqctl status
   redis-cli info
   ```

### Check Documentation

- [Getting Started](GETTING_STARTED.md)
- [Architecture Guide](ARCHITECTURE.md)
- [Testing Guide](TESTING.md)
- [Node Types](NODE_TYPES.md)

### Open an Issue

Create a GitHub issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs and configuration
- Environment details

---

**Still having issues?** Join our community chat or check the FAQ in the main README.
