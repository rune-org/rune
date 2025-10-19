# Getting Started with Rune Workflow Worker

This guide will help you install, configure, and run your first workflow with the Rune Workflow Worker.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Go 1.25+** - [Download Go](https://golang.org/dl/)
- **RabbitMQ** - Message broker for workflow orchestration
- **Redis** - State management and caching
- **Docker** (optional) - For containerized deployment

## Installation

### Option 1: Build from Source

```bash
# Navigate to the worker directory
cd services/rune-worker

# Download dependencies
go mod download

# Build the worker binary
go build -o worker cmd/worker/main.go

# Verify the build
./worker --version
```

### Option 2: Using Docker

```bash
# Build the Docker image
docker build -t rune-worker:latest .

# Run the container
docker run -d \
  --name rune-worker \
  --env-file .env \
  rune-worker:latest
```

### Option 3: Using Go Install

```bash
# Install directly
go install ./cmd/worker

# Run from $GOPATH/bin
worker
```

## Setting Up Dependencies

### RabbitMQ Setup

**Using Docker (Recommended for Development):**

```bash
# Start RabbitMQ with management plugin
docker run -d \
  --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=guest \
  -e RABBITMQ_DEFAULT_PASS=guest \
  rabbitmq:4.0-management-alpine

# Wait for RabbitMQ to start (about 10-15 seconds)
sleep 15

# Access management UI at http://localhost:15672
# Login: guest / guest
```

**Using Homebrew (macOS):**

```bash
# Install RabbitMQ
brew install rabbitmq

# Start RabbitMQ service
brew services start rabbitmq

# Or run in foreground
/usr/local/opt/rabbitmq/sbin/rabbitmq-server
```

**Using apt (Ubuntu/Debian):**

```bash
# Install RabbitMQ
sudo apt-get update
sudo apt-get install rabbitmq-server

# Start RabbitMQ
sudo systemctl start rabbitmq-server
sudo systemctl enable rabbitmq-server

# Enable management plugin
sudo rabbitmq-plugins enable rabbitmq_management
```

### Redis Setup

**Using Docker:**

```bash
# Start Redis
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine

# Verify Redis is running
docker exec redis redis-cli ping
# Should return: PONG
```

**Using Homebrew (macOS):**

```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Or run in foreground
redis-server
```

**Using apt (Ubuntu/Debian):**

```bash
# Install Redis
sudo apt-get update
sudo apt-get install redis-server

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

## Configuration

### Environment Variables

Create a `.env` file in the worker root directory:

```bash
# RabbitMQ Configuration
RABBITMQ_URL=amqp://guest:guest@localhost:5672/

# Workflow Queue Configuration
WORKFLOW_QUEUE_NAME=workflow.execution
WORKFLOW_PREFETCH=10
WORKFLOW_CONCURRENCY=1

# Redis Configuration
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# Worker Configuration
WORKER_ID=worker-1
LOG_LEVEL=info
LOG_FORMAT=json

# Service Configuration
GRACEFUL_SHUTDOWN_TIMEOUT=30s
```

### Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672/` | RabbitMQ connection URL |
| `WORKFLOW_QUEUE_NAME` | `workflow.execution` | Queue name for workflow execution messages |
| `WORKFLOW_PREFETCH` | `10` | Number of messages to prefetch |
| `WORKFLOW_CONCURRENCY` | `1` | Number of concurrent workflow executions |
| `REDIS_ADDR` | `localhost:6379` | Redis server address |
| `REDIS_PASSWORD` | `` | Redis password (if required) |
| `REDIS_DB` | `0` | Redis database number |
| `WORKER_ID` | `worker-1` | Unique identifier for this worker instance |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `LOG_FORMAT` | `json` | Log format (json, text) |
| `GRACEFUL_SHUTDOWN_TIMEOUT` | `30s` | Graceful shutdown timeout |

### Configuration File (Alternative)

Instead of environment variables, you can use a `config.yaml` file:

```yaml
rabbitmq:
  url: amqp://guest:guest@localhost:5672/
  
workflow_queue:
  name: workflow.execution
  prefetch: 10
  concurrency: 1

redis:
  addr: localhost:6379
  password: ""
  db: 0

worker:
  id: worker-1
  
logging:
  level: info
  format: json
```

Place this file in the worker root directory or specify the path:

```bash
./worker --config /path/to/config.yaml
```

## Running the Worker

### Development Mode

```bash
# Run directly
./worker

# Or with go run
go run cmd/worker/main.go

# With verbose logging
LOG_LEVEL=debug ./worker

# With custom config
./worker --config config.yaml
```

### Production Mode

```bash
# Build optimized binary
go build -ldflags="-s -w" -o worker cmd/worker/main.go

# Run with systemd (Linux)
sudo systemctl start rune-worker

# Run with supervisord
supervisorctl start rune-worker

# Run with Docker Compose
docker-compose up -d rune-worker
```

### Docker Compose Setup

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  rabbitmq:
    image: rabbitmq:4.0-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  rune-worker:
    build: .
    depends_on:
      rabbitmq:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672/
      REDIS_ADDR: redis:6379
      WORKFLOW_QUEUE_NAME: workflow.execution
      LOG_LEVEL: info
    restart: unless-stopped
```

Start all services:

```bash
docker-compose up -d
```

## Running Your First Workflow

### Step 1: Create a Workflow Definition

Create a file `simple_workflow.json`:

```json
{
  "id": "hello_workflow",
  "name": "Hello World Workflow",
  "description": "A simple workflow that logs a message",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "log1",
      "name": "LogHello",
      "type": "log",
      "parameters": {
        "message": "Hello, World! This is my first workflow."
      }
    },
    {
      "id": "log2",
      "name": "LogTimestamp",
      "type": "log",
      "parameters": {
        "message": "Workflow executed at {{$input.timestamp}}"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "src": "log1",
      "dst": "log2"
    }
  ]
}
```

### Step 2: Submit the Workflow

You can submit workflows using the Rune Master Service API or directly to RabbitMQ for testing.

**Using Python script for testing:**

```python
#!/usr/bin/env python3
import json
import pika
from datetime import datetime

# Load workflow definition
with open('simple_workflow.json', 'r') as f:
    workflow = json.load(f)

# Create execution message
message = {
    "workflow_id": workflow["id"],
    "execution_id": f"exec_{datetime.now().timestamp()}",
    "current_node": "log1",  # Start node
    "workflow_definition": workflow,
    "accumulated_context": {
        "$input": {
            "timestamp": datetime.now().isoformat()
        }
    }
}

# Connect to RabbitMQ
connection = pika.BlockingConnection(
    pika.ConnectionParameters('localhost')
)
channel = connection.channel()

# Publish message
channel.basic_publish(
    exchange='workflows',
    routing_key='workflow.execution',
    body=json.dumps(message)
)

print(f"Workflow submitted: {message['execution_id']}")
connection.close()
```

### Step 3: Monitor Execution

Check the worker logs:

```bash
# If running locally
tail -f worker.log

# If running with Docker
docker logs -f rune-worker

# If using Docker Compose
docker-compose logs -f rune-worker
```

Expected output:

```json
{"time":"2025-10-17T12:00:00Z","level":"INFO","msg":"processing node","workflow_id":"hello_workflow","execution_id":"exec_1697544000","node_id":"log1"}
{"time":"2025-10-17T12:00:00Z","level":"INFO","msg":"Hello, World! This is my first workflow."}
{"time":"2025-10-17T12:00:01Z","level":"INFO","msg":"processing node","workflow_id":"hello_workflow","execution_id":"exec_1697544000","node_id":"log2"}
{"time":"2025-10-17T12:00:01Z","level":"INFO","msg":"Workflow executed at 2025-10-17T12:00:00Z"}
{"time":"2025-10-17T12:00:01Z","level":"INFO","msg":"workflow completed","workflow_id":"hello_workflow","execution_id":"exec_1697544000"}
```

## Verifying the Installation

### Check Worker Status

```bash
# Check if worker is running
ps aux | grep worker

# Check Docker container status
docker ps | grep rune-worker

# Check logs for startup messages
tail -n 50 worker.log
```

### Verify RabbitMQ Connection

1. Open RabbitMQ Management UI: http://localhost:15672
2. Login with `guest` / `guest`
3. Check **Queues** tab - you should see:
   - `workflow.execution`
   - `workflow.node.status`
   - `workflow.completion`
4. Check **Connections** tab - worker should be connected

### Verify Redis Connection

```bash
# Test Redis connectivity
redis-cli -h localhost -p 6379 ping
# Expected: PONG

# Check Redis keys (if any workflows have run)
redis-cli -h localhost -p 6379 keys "*"
```

### Run Health Check

```bash
# If health check endpoint is enabled
curl http://localhost:8080/health

# Expected response
{"status":"ok","services":{"rabbitmq":"connected","redis":"connected"}}
```

## Troubleshooting

### Worker Won't Start

**Check dependencies:**
```bash
# Verify RabbitMQ is running
docker ps | grep rabbitmq
# Or
systemctl status rabbitmq-server

# Verify Redis is running
docker ps | grep redis
# Or
systemctl status redis-server
```

**Check configuration:**
```bash
# Validate environment variables
env | grep RABBITMQ
env | grep REDIS

# Test RabbitMQ connectivity
telnet localhost 5672

# Test Redis connectivity
redis-cli -h localhost -p 6379 ping
```

### Connection Issues

**RabbitMQ connection errors:**
- Verify RabbitMQ is running on the correct port
- Check firewall rules
- Verify credentials in `RABBITMQ_URL`
- Check RabbitMQ logs: `docker logs rabbitmq`

**Redis connection errors:**
- Verify Redis is running on the correct port
- Check if Redis requires authentication
- Test with: `redis-cli -h localhost -p 6379 ping`

### Workflow Not Processing

**Check queue status:**
```bash
# View RabbitMQ queues
rabbitmqctl list_queues name messages

# Or use Management UI
# http://localhost:15672/#/queues
```

**Verify message format:**
- Ensure workflow definition is valid JSON
- Check required fields: `workflow_id`, `execution_id`, `current_node`
- Validate node types are registered

## Next Steps

Now that your worker is running, you can:

1. **Explore Node Types** - Learn about built-in nodes in [Node Types Documentation](NODE_TYPES.md)
2. **Create Complex Workflows** - Study examples in [Workflow DSL Documentation](WORKFLOW_DSL.md)
3. **Build Custom Nodes** - Extend functionality with [Custom Nodes Guide](CUSTOM_NODES.md)
4. **Run Tests** - Validate your setup with [Testing Guide](TESTING.md)
5. **Review Architecture** - Understand the system in [Architecture Documentation](ARCHITECTURE.md)

## Additional Resources

- [Environment Variable Reference](#configuration-options)
- [Docker Compose Configuration](#docker-compose-setup)
- [Production Deployment Best Practices](../rfcs/README.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)

---

**Need Help?** Check the [Troubleshooting Guide](TROUBLESHOOTING.md) or open an issue on GitHub.
