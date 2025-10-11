# Rune Workflow Worker# Workflow Worker



A pluggable, message-driven workflow execution engine built on RabbitMQ. The worker implements RFC-001's recursive node-by-node execution model, processing workflows defined in the RFC-002 DSL format.This project provides a pluggable worker service for executing workflows driven by messages from RabbitMQ. The layout separates the core components into dedicated packages for DSL parsing, node execution, consumers, and queue management.



## Architecture## Structure



The worker consumes node execution messages from RabbitMQ, executes workflow nodes, accumulates context, and publishes status updates and next-step messages back to the queue. This distributed architecture enables horizontal scaling and fault tolerance through message acknowledgments.- `cmd/worker`: Application entrypoint.

- `pkg/consumers`: Message consumer logic.

## Project Structure

```
cmd/worker/          Application entrypoint with service initialization
pkg/
  ├── core/          Core workflow types (Workflow, Node, Edge, etc.)
  ├── dsl/           DSL parsing, validation, and graph analysis
  ├── executor/      RFC-001 recursive executor implementation
  ├── messaging/     Message consumer and publisher for RabbitMQ
  ├── nodes/         Built-in node registry and implementations
  │   └── custom/    Custom node types (log, http, etc.)
  ├── messages/      Message type definitions and encoding
  ├── platform/      Infrastructure components (config, queue)
  └── registry/      Auto-registration system for nodes
plugin/              Public API for third-party node implementations
rfcs/                Architecture and specification documents
```

## Features



- **🔄 Recursive Execution**: Node-by-node execution per RFC-001Extend the DSL types, executor logic, and node implementations to model your workflows. Use the `plugin` package as the contract for custom nodes.

- **📊 Context Accumulation**: Results stored with `$<node_name>` keys
- **🔀 Conditional Branching**: Support for conditional and split nodes
- **🔐 Credential Management**: Secure credential passing from master service
- **🛡️ Error Handling**: Configurable strategies (halt, ignore, branch)
- **📡 Status Tracking**: Real-time status messages for monitoring
- **⚡ Fault Tolerance**: At-least-once delivery through message acknowledgments
- **🔌 Extensible**: Plugin architecture for custom node types

## Getting Started

### Prerequisites

- **Go 1.25+** installed
- **RabbitMQ** running (default: `localhost:5672`)
- **Docker** (optional, for containerized deployment)

### Installation

```bash
cd services/rune-worker

# Install dependencies
go mod download

# Build the worker
go build -o worker cmd/worker/main.go
```

### Configuration

Create or edit `.env` file:

```bash
# RabbitMQ Configuration
RABBITMQ_URL=amqp://guest:guest@localhost:5672/

# Workflow Queue Configuration
WORKFLOW_QUEUE_NAME=workflow.execution
WORKFLOW_PREFETCH=10
WORKFLOW_CONCURRENCY=1
```

### Running the Worker

```bash
# Run directly
./worker

# Or with go run
go run cmd/worker/main.go

# With Docker
docker build -t rune-worker .
docker run --env-file .env rune-worker
```

## Built-in Node Types

### Log Node
Simple logging node for debugging and status messages.

```json
{
  "id": "log1",
  "name": "LogStep",
  "type": "log",
  "parameters": {
    "message": "Processing user: {{$fetchUser.username}}"
  }
}
```

### HTTP Node
Make HTTP requests with full configuration support.

```json
{
  "id": "api1",
  "name": "FetchUserData",
  "type": "http",
  "parameters": {
    "method": "GET",
    "url": "https://api.example.com/users/{{$input.userId}}",
    "headers": {
      "Authorization": "Bearer {{$credential.api_token}}",
      "Content-Type": "application/json"
    },
    "query": {
      "include": "profile,settings"
    },
    "timeout": 30,
    "retry": 3,
    "retry_delay": 1000,
    "raise_on_status": "4xx,5xx",
    "ignore_ssl": false
  },
  "credentials": {
    "source": "credential_id_123"
  }
}
```

## Workflow DSL Examples

### Example 1: Simple Linear Workflow

```json
{
  "id": "simple_workflow",
  "name": "User Data Fetch",
  "description": "Fetch and log user data",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "fetch",
      "name": "FetchUser",
      "type": "http",
      "parameters": {
        "method": "GET",
        "url": "https://api.example.com/users/123"
      }
    },
    {
      "id": "log",
      "name": "LogResult",
      "type": "log",
      "parameters": {
        "message": "Fetched user: {{$fetch.name}}"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "src": "fetch",
      "dst": "log"
    }
  ]
}
```

### Example 2: Conditional Branching Workflow

```json
{
  "id": "conditional_workflow",
  "name": "User Validation Workflow",
  "description": "Validate user and branch based on status",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "fetch_user",
      "name": "FetchUser",
      "type": "http",
      "parameters": {
        "method": "GET",
        "url": "https://api.example.com/users/{{$input.userId}}"
      }
    },
    {
      "id": "check_status",
      "name": "CheckUserStatus",
      "type": "conditional",
      "parameters": {
        "condition": "{{$fetch_user.status}} == 'active'",
        "true_edge_id": "to_active",
        "false_edge_id": "to_inactive"
      }
    },
    {
      "id": "send_welcome",
      "name": "SendWelcomeEmail",
      "type": "http",
      "parameters": {
        "method": "POST",
        "url": "https://api.example.com/emails/send",
        "body": {
          "to": "{{$fetch_user.email}}",
          "template": "welcome"
        }
      },
      "credentials": {
        "source": "email_api_key"
      }
    },
    {
      "id": "notify_admin",
      "name": "NotifyAdmin",
      "type": "http",
      "parameters": {
        "method": "POST",
        "url": "https://api.example.com/admin/notify",
        "body": {
          "message": "Inactive user login attempt",
          "userId": "{{$fetch_user.id}}"
        }
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "src": "fetch_user",
      "dst": "check_status"
    },
    {
      "id": "to_active",
      "src": "check_status",
      "dst": "send_welcome",
      "label": "User Active"
    },
    {
      "id": "to_inactive",
      "src": "check_status",
      "dst": "notify_admin",
      "label": "User Inactive"
    }
  ]
}
```

### Example 3: Error Handling Workflow

```json
{
  "id": "resilient_workflow",
  "name": "API Call with Error Handling",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "api_call",
      "name": "CallExternalAPI",
      "type": "http",
      "parameters": {
        "method": "POST",
        "url": "https://api.example.com/process",
        "retry": 3,
        "timeout": 30
      },
      "error": {
        "type": "branch",
        "error_edge": "to_fallback"
      }
    },
    {
      "id": "success_log",
      "name": "LogSuccess",
      "type": "log",
      "parameters": {
        "message": "API call succeeded"
      }
    },
    {
      "id": "fallback",
      "name": "HandleError",
      "type": "log",
      "parameters": {
        "message": "API call failed, using fallback"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "src": "api_call",
      "dst": "success_log"
    },
    {
      "id": "to_fallback",
      "src": "api_call",
      "dst": "fallback",
      "label": "On Error"
    }
  ]
}
```

### Example 4: Workflow with Credentials

```json
{
  "id": "secure_workflow",
  "name": "Authenticated API Workflow",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "auth_api",
      "name": "CallSecureAPI",
      "type": "http",
      "parameters": {
        "method": "GET",
        "url": "https://api.example.com/secure/data",
        "headers": {
          "Authorization": "Bearer {{$credential.api_token}}"
        }
      },
      "credentials": {
        "source": "production_api_key",
        "values": {
          "api_token": "resolved_by_master_service"
        }
      }
    },
    {
      "id": "send_email",
      "name": "SendNotification",
      "type": "smtp",
      "parameters": {
        "to": "admin@example.com",
        "subject": "Data Retrieved",
        "body": "Retrieved {{$auth_api.count}} records"
      },
      "credentials": {
        "source": "smtp_credentials",
        "values": {
          "smtp_host": "smtp.gmail.com",
          "smtp_user": "notifications@example.com",
          "smtp_pass": "resolved_by_master_service"
        }
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "src": "auth_api",
      "dst": "send_email"
    }
  ]
}
```

## Message Flow

### RabbitMQ Architecture

The worker uses a **topic exchange** named `workflows` for all message routing. Exchanges and queues are **automatically declared** when the service starts, ensuring zero-configuration deployment.

**Exchange:** `workflows` (topic, durable)  
**Routing:** Queue name = Routing key

The worker participates in three RabbitMQ queues:

1. **`workflow.execution`** (input): Node execution messages to process
2. **`workflow.node.status`** (output): Status updates (running, success, failed)
3. **`workflow.completion`** (output): Workflow completion messages

All queues and bindings are automatically created and configured as durable. See [RABBITMQ_ARCHITECTURE.md](./RABBITMQ_ARCHITECTURE.md) for detailed information about the messaging infrastructure.

### Node Execution Message
```json
{
  "workflow_id": "wf_123",
  "execution_id": "exec_456",
  "current_node": "node_1",
  "workflow_definition": { ... },
  "accumulated_context": {
    "$previous_node": { "result": "value" }
  }
}
```

### Node Status Message
```json
{
  "workflow_id": "wf_123",
  "execution_id": "exec_456",
  "node_id": "node_1",
  "node_name": "FetchUser",
  "status": "success",
  "output": { "user_id": 123, "name": "John" },
  "executed_at": "2025-10-10T12:00:00Z",
  "duration_ms": 250
}
```

### Completion Message
```json
{
  "workflow_id": "wf_123",
  "execution_id": "exec_456",
  "status": "completed",
  "final_context": { ... },
  "completed_at": "2025-10-10T12:00:05Z",
  "total_duration_ms": 5000
}
```

## Development

### Running Tests

#### Unit Tests

Unit tests are fast, isolated tests that don't require external services:

```bash
# Run all unit tests
go test ./...

# Run with coverage
go test ./... -cover

# Run specific package tests
go test ./pkg/executor/... -v

# Run HTTP node tests
go test ./pkg/nodes/custom/http/... -v

# Run with verbose output and coverage report
go test -v -cover ./pkg/...
```

#### Integration Tests

Integration tests verify end-to-end flows with Redis and RabbitMQ. These tests require running service containers and are marked with the `integration` build tag.

##### Running Integration Tests Locally


**Option 1: Using Existing Services**

If you already have Redis and RabbitMQ running:

```bash
# Set connection URLs (optional if using defaults)
export RABBITMQ_URL="amqp://guest:guest@localhost:5672/"
export REDIS_ADDR="localhost:6379"

# Run integration tests
go test -v -tags=integration ./integration/...
```

**Option 2: Quick Test Setup**

```bash
# Start Redis
docker run -d --name redis-test -p 6379:6379 redis:7-alpine

# Start RabbitMQ
docker run -d --name rabbitmq-test \
  -p 5672:5672 -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=guest \
  -e RABBITMQ_DEFAULT_PASS=guest \
  rabbitmq:3-management-alpine

# Wait for services
sleep 15

# Run integration tests
go test -v -tags=integration ./integration/...

# Cleanup
docker rm -f redis-test rabbitmq-test
```

##### Integration Test Coverage

The integration test suite covers:

- ✅ **End-to-End Workflow Execution**: Complete workflow processing from message consumption to completion
- ✅ **Redis Context Management**: Storing and retrieving workflow context from Redis
- ✅ **Error Handling**: Processing workflows with invalid node types and error recovery
- ✅ **Message Acknowledgment**: Proper ACK/NACK behavior for message reliability
- ✅ **RabbitMQ Operations**: Message publishing, consumption, and queue management
- ✅ **Redis Operations**: SET, GET, INCR, JSON storage, and key expiration
- ✅ **Service Recovery**: Consumer behavior during connection issues

##### CI/CD Integration Tests

Integration tests run automatically in GitHub Actions CI with service containers:

```yaml
# In .github/workflows/rune-worker-ci.yml
services:
  redis:
    image: redis:7-alpine
  rabbitmq:
    image: rabbitmq:3-management-alpine
```

The CI pipeline:
1. Starts Redis and RabbitMQ service containers
2. Waits for services to be healthy
3. Runs unit tests (without build tags)
4. Runs integration tests (with `-tags=integration`)

##### Writing Integration Tests

Integration tests are located in the `integration/` directory and use the `integration` build tag:

```go
//go:build integration

package integration

import (
    "testing"
    "rune-worker/pkg/core"
    // ... other imports
)

func TestMyIntegration(t *testing.T) {
    // Setup Redis and RabbitMQ connections
    // Run end-to-end tests
    // Cleanup resources
}
```

All integration tests should be placed in the `integration/` folder to keep them separate from unit tests.

##### Test Configuration

Integration tests use these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672/` | RabbitMQ connection URL |
| `REDIS_ADDR` | `localhost:6379` | Redis server address |

##### Troubleshooting Integration Tests

**Tests timeout or fail to connect:**
- Verify services are running: `docker ps`
- Check service logs: `docker logs <container-id>`
- Ensure ports are not already in use
- Wait longer for services to be ready (especially RabbitMQ)

**Redis connection errors:**
```bash
# Test Redis connectivity
redis-cli -h localhost -p 6379 ping
# Should return: PONG
```

**RabbitMQ connection errors:**
```bash
# Test RabbitMQ connectivity
curl http://localhost:15672
# Should return the management UI
```

**Tests pass locally but fail in CI:**
- Check service container health checks in CI config
- Verify environment variables are set correctly
- Review CI logs for service startup errors

### Creating Custom Node Types

The worker uses an **auto-registration system** - nodes automatically register themselves when their package is imported. This guide walks through creating a complete custom node implementation.

#### Overview

Custom nodes must:
1. Implement the `plugin.Node` interface
2. Register themselves in the `init()` function
3. Be imported in `pkg/registry/init_registry.go`

#### Step 1: Create Node Package Structure

```bash
# Create directory for your node
mkdir -p pkg/nodes/custom/mynode

# If your node has complex parameters, create a parameters file
touch pkg/nodes/custom/mynode/parameters.go
touch pkg/nodes/custom/mynode/mynode.go
touch pkg/nodes/custom/mynode/mynode_test.go
```

#### Step 2: Define Parameters (Optional)

If your node has structured parameters, define them in a separate file:

```go
// pkg/nodes/custom/mynode/parameters.go
package mynode

// MyNodeParameters defines configuration for MyNode
type MyNodeParameters struct {
    Message    string            `json:"message"`
    Timeout    int               `json:"timeout,string"`
    Options    map[string]string `json:"options"`
    RetryCount int               `json:"retry_count,string"`
}
```

#### Step 3: Implement the Node

Create your node implementation following this template:

```go
// pkg/nodes/custom/mynode/mynode.go
package mynode

import (
    "context"
    "fmt"
    "log/slog"
    "time"
    
    "rune-worker/pkg/nodes"
    "rune-worker/plugin"
)

// MyNode implements custom business logic
type MyNode struct {
    message    string
    timeout    time.Duration
    options    map[string]string
    retryCount int
}

// NewMyNode creates a new instance from execution context
func NewMyNode(execCtx plugin.ExecutionContext) *MyNode {
    node := &MyNode{
        message:    "default message",
        timeout:    30 * time.Second,
        options:    make(map[string]string),
        retryCount: 0,
    }
    
    // Parse parameters from execution context
    if msg, ok := execCtx.Parameters["message"].(string); ok {
        node.message = msg
    }
    
    if timeout, ok := execCtx.Parameters["timeout"].(float64); ok {
        node.timeout = time.Duration(timeout) * time.Second
    }
    
    if opts, ok := execCtx.Parameters["options"].(map[string]interface{}); ok {
        for k, v := range opts {
            if strVal, ok := v.(string); ok {
                node.options[k] = strVal
            }
        }
    }
    
    if retry, ok := execCtx.Parameters["retry_count"].(float64); ok {
        node.retryCount = int(retry)
    }
    
    return node
}

// Execute implements the plugin.Node interface
func (n *MyNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
    slog.Info("executing mynode",
        "node_id", execCtx.NodeID,
        "message", n.message,
    )
    
    // Create context with timeout
    timeoutCtx, cancel := context.WithTimeout(ctx, n.timeout)
    defer cancel()
    
    // Implement your business logic here
    result, err := n.performWork(timeoutCtx, execCtx)
    if err != nil {
        return nil, fmt.Errorf("mynode execution failed: %w", err)
    }
    
    // Return output that will be available to subsequent nodes
    return map[string]any{
        "success": true,
        "message": n.message,
        "result":  result,
        "options": n.options,
    }, nil
}

// performWork contains the actual node logic
func (n *MyNode) performWork(ctx context.Context, execCtx plugin.ExecutionContext) (string, error) {
    // Access input from previous nodes via execCtx.Input
    // Example: previousOutput := execCtx.Input["$previous_node"]
    
    // Access credentials if needed
    if execCtx.HasCredentials() {
        creds := execCtx.GetCredentials()
        // Use credentials for authentication
        _ = creds
    }
    
    // Your implementation here
    return "work completed successfully", nil
}

// init registers the node type automatically on package import
func init() {
    nodes.RegisterNodeType(RegisterMyNode)
}

// RegisterMyNode registers the node type with the registry
func RegisterMyNode(reg *nodes.Registry) {
    reg.Register("mynode", func(execCtx plugin.ExecutionContext) plugin.Node {
        return NewMyNode(execCtx)
    })
}
```

#### Step 4: Write Tests

Create comprehensive tests for your node:

```go
// pkg/nodes/custom/mynode/mynode_test.go
package mynode

import (
    "context"
    "testing"
    
    "rune-worker/plugin"
)

func TestMyNode_Execute(t *testing.T) {
    tests := []struct {
        name       string
        params     map[string]interface{}
        input      map[string]interface{}
        wantErr    bool
        wantResult string
    }{
        {
            name: "basic execution",
            params: map[string]interface{}{
                "message": "test message",
                "timeout": 30,
            },
            input:      make(map[string]interface{}),
            wantErr:    false,
            wantResult: "work completed successfully",
        },
        {
            name: "with options",
            params: map[string]interface{}{
                "message": "test",
                "options": map[string]interface{}{
                    "key1": "value1",
                    "key2": "value2",
                },
            },
            input:      make(map[string]interface{}),
            wantErr:    false,
            wantResult: "work completed successfully",
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            execCtx := plugin.ExecutionContext{
                WorkflowID:  "test_workflow",
                ExecutionID: "test_execution",
                NodeID:      "test_node",
                Type:        "mynode",
                Parameters:  tt.params,
                Input:       tt.input,
            }
            
            node := NewMyNode(execCtx)
            
            output, err := node.Execute(context.Background(), execCtx)
            
            if (err != nil) != tt.wantErr {
                t.Errorf("Execute() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            
            if !tt.wantErr {
                if result, ok := output["result"].(string); ok {
                    if result != tt.wantResult {
                        t.Errorf("Execute() result = %v, want %v", result, tt.wantResult)
                    }
                } else {
                    t.Errorf("Execute() output missing 'result' field")
                }
                
                if success, ok := output["success"].(bool); !ok || !success {
                    t.Errorf("Execute() success = %v, want true", success)
                }
            }
        })
    }
}

func TestMyNode_ParameterParsing(t *testing.T) {
    execCtx := plugin.ExecutionContext{
        Parameters: map[string]interface{}{
            "message":     "custom message",
            "timeout":     60.0,
            "retry_count": 3.0,
            "options": map[string]interface{}{
                "opt1": "val1",
            },
        },
        Input: make(map[string]interface{}),
    }
    
    node := NewMyNode(execCtx)
    
    if node.message != "custom message" {
        t.Errorf("message = %v, want 'custom message'", node.message)
    }
    
    if node.retryCount != 3 {
        t.Errorf("retryCount = %v, want 3", node.retryCount)
    }
    
    if len(node.options) != 1 || node.options["opt1"] != "val1" {
        t.Errorf("options not parsed correctly: %v", node.options)
    }
}
```

#### Step 5: Register the Node

Add a blank import to `pkg/registry/init_registry.go`:

```go
package registry

import (
    "log/slog"
    "rune-worker/pkg/nodes"
    
    // Import all node packages to trigger their init() functions
    _ "rune-worker/pkg/nodes/custom/http"
    _ "rune-worker/pkg/nodes/custom/mynode"  // Add your node here
)

// InitializeRegistry creates and populates the node registry
func InitializeRegistry() *nodes.Registry {
    reg := nodes.NewRegistry()
    
    // Call all registered node registration functions
    for _, register := range nodes.GetRegisteredNodeTypes() {
        register(reg)
    }
    
    types := reg.GetAllTypes()
    slog.Info("node registry initialized", "registered_nodes", len(types), "types", types)
    
    return reg
}
```

#### Step 6: Test Your Node

```bash
# Run your node tests
go test ./pkg/nodes/custom/mynode/... -v

# Run all tests
go test ./pkg/... -v

# Test with coverage
go test ./pkg/nodes/custom/mynode/... -cover
```

#### Step 7: Use in Workflow DSL

Once registered, your node can be used in workflow definitions:

```json
{
  "id": "my_custom_node",
  "name": "MyCustomStep",
  "type": "mynode",
  "parameters": {
    "message": "Processing data",
    "timeout": 60,
    "retry_count": 3,
    "options": {
      "mode": "production",
      "verbose": "true"
    }
  },
  "credentials": {
    "source": "my_service_key"
  }
}
```

#### Advanced Features

##### Accessing Previous Node Output

```go
func (n *MyNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
    // Access output from previous node named "fetch_user"
    if userData, ok := execCtx.Input["$fetch_user"].(map[string]interface{}); ok {
        userID := userData["user_id"]
        // Use userID in your logic
    }
    
    // Access trigger data
    if triggerData, ok := execCtx.Input["$trigger"].(map[string]interface{}); ok {
        // Use trigger data
    }
    
    // ... rest of implementation
}
```

##### Working with Credentials

```go
func (n *MyNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
    // Check if credentials are available
    if !execCtx.HasCredentials() {
        return nil, fmt.Errorf("credentials required but not provided")
    }
    
    creds := execCtx.GetCredentials()
    
    // Access credential values
    apiKey, ok := creds["api_key"].(string)
    if !ok {
        return nil, fmt.Errorf("api_key credential not found")
    }
    
    // Use credentials for authentication
    // ... implementation
}
```

##### Error Handling with Retries

```go
func (n *MyNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
    var lastErr error
    
    for attempt := 0; attempt <= n.retryCount; attempt++ {
        if attempt > 0 {
            slog.Warn("retrying operation", 
                "attempt", attempt, 
                "max_retries", n.retryCount,
            )
            time.Sleep(time.Second * time.Duration(attempt))
        }
        
        result, err := n.performWork(ctx, execCtx)
        if err == nil {
            return map[string]any{
                "success": true,
                "result":  result,
                "attempts": attempt + 1,
            }, nil
        }
        
        lastErr = err
    }
    
    return nil, fmt.Errorf("operation failed after %d attempts: %w", 
        n.retryCount+1, lastErr)
}
```

#### Registration System Details

**How It Works:**

1. **Package Import**: When `pkg/registry` is imported, it triggers blank imports of all node packages
2. **Init Functions**: Each node package's `init()` function runs automatically at program startup
3. **Registration**: `nodes.RegisterNodeType()` adds the registration function to a global list
4. **Initialization**: `registry.InitializeRegistry()` calls all registered functions to populate the registry
5. **Execution**: The executor looks up nodes by type name when processing workflows

**Benefits:**

✅ **Automatic Discovery** - New nodes are found automatically  
✅ **Zero Configuration** - No manual registration lists to maintain  
✅ **Clean Separation** - Each node is self-contained in its package  
✅ **Type Safety** - Compile-time verification of node implementations  
✅ **Easy Testing** - Nodes can be unit tested independently  
✅ **Extensibility** - Add new nodes without modifying core code

#### Best Practices

1. **Parameter Validation**: Always validate and provide defaults for parameters
2. **Context Handling**: Respect context cancellation for graceful shutdown
3. **Structured Logging**: Use `slog` with contextual information
4. **Error Messages**: Return descriptive errors with context
5. **Output Format**: Return consistent map structure for node output
6. **Testing**: Write comprehensive tests including edge cases
7. **Documentation**: Document parameters and expected behavior
8. **Credentials**: Never log sensitive credential information
9. **Timeouts**: Always use timeouts for external calls
10. **Idempotency**: Design nodes to be safely retryable when possible

## Monitoring and Observability

The worker provides structured JSON logging:

```json
{"time":"2025-10-10T12:00:00Z","level":"INFO","msg":"starting rune workflow worker","version":"1.0.0"}
{"time":"2025-10-10T12:00:01Z","level":"INFO","msg":"configuration loaded","queue_name":"workflow.execution"}
{"time":"2025-10-10T12:00:02Z","level":"INFO","msg":"node registry initialized","registered_nodes":2}
{"time":"2025-10-10T12:00:03Z","level":"INFO","msg":"workflow worker ready to process messages"}
```

## Architecture References

- **RFC-001**: Recursive Node-by-Node Workflow Execution Architecture
- **RFC-002**: Workflow Definition DSL Specification

See the `rfcs/` directory for complete specifications.

## Troubleshooting

### Worker not connecting to RabbitMQ
- Verify RabbitMQ is running: `docker ps` or check service status
- Check `RABBITMQ_URL` in `.env`
- Ensure RabbitMQ port 5672 is accessible

### Messages not being processed
- Check queue name matches: `WORKFLOW_QUEUE_NAME`
- Verify messages are in the queue: RabbitMQ Management UI (http://localhost:15672)
- Check worker logs for errors

### Node execution failures
- Review node parameters in workflow definition
- Check credential configuration
- Verify external service URLs are accessible
- Check node-specific error messages in logs

## License

See LICENSE file in the repository root.
