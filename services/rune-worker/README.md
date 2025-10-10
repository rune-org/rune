# Rune Workflow Worker# Workflow Worker



A pluggable, message-driven workflow execution engine built on RabbitMQ. The worker implements RFC-001's recursive node-by-node execution model, processing workflows defined in the RFC-002 DSL format.This project provides a pluggable worker service for executing workflows driven by messages from RabbitMQ. The layout separates the core components into dedicated packages for DSL parsing, node execution, consumers, and queue management.



## Architecture## Structure



The worker consumes node execution messages from RabbitMQ, executes workflow nodes, accumulates context, and publishes status updates and next-step messages back to the queue. This distributed architecture enables horizontal scaling and fault tolerance through message acknowledgments.- `cmd/worker`: Application entrypoint.

- `pkg/consumers`: Message consumer logic.

## Project Structure- `pkg/dsl`: DSL parsing, validation, and graph analysis.

- `pkg/executor`: Step execution framework.

```- `pkg/nodes`: Built-in node registry and default implementations.

cmd/worker/          Application entrypoint with service initialization- `pkg/queue`: RabbitMQ connectivity helpers.

pkg/- `plugin`: Public API for third-party node implementations.

  ├── messaging/     Message consumer and publisher for RabbitMQ

  ├── executor/      RFC-001 recursive executor implementation## Getting Started

  ├── dsl/          DSL parsing, validation, and graph analysis

  ├── nodes/        Built-in node registry and implementations1. Ensure you have Go 1.25 or newer installed.

  │   └── custom/   Custom node types (log, http, etc.)2. Copy `.env` and adjust the RabbitMQ URL or queue settings as needed.

  ├── messages/     Message type definitions and encoding3. Install dependencies and run a build:

  └── platform/     Infrastructure components (config, queue)

plugin/             Public API for third-party node implementations```sh

rfcs/               Architecture and specification documentscd rune-worker

```go mod tidy

go build ./...

## Features```



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

The worker participates in three RabbitMQ queues:

1. **`workflow.execution`** (input): Node execution messages to process
2. **`workflow.node.status`** (output): Status updates (running, success, failed)
3. **`workflow.completion`** (output): Workflow completion messages

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

```bash
# Run all tests
go test ./...

# Run with coverage
go test ./... -cover

# Run specific package tests
go test ./pkg/executor/... -v

# Run HTTP node tests
go test ./pkg/nodes/custom/http/... -v
```

### Adding Custom Nodes

The worker uses an **auto-registration system** - nodes automatically register themselves when their package is imported. No manual registration needed!

#### Step 1: Create Your Node Implementation

Create a new directory for your node type:

```bash
mkdir -p pkg/nodes/custom/mynode
```

Implement the `plugin.Node` interface:

```go
// pkg/nodes/custom/mynode/mynode.go
package mynode

import (
    "context"
    "rune-worker/pkg/nodes"
    "rune-worker/plugin"
)

type MyCustomNode struct {
    // Your node fields
    message string
}

func NewMyCustomNode(execCtx plugin.ExecutionContext) *MyCustomNode {
    node := &MyCustomNode{
        message: "default message",
    }
    
    // Parse parameters from execution context
    if msg, ok := execCtx.Parameters["message"].(string); ok {
        node.message = msg
    }
    
    return node
}

func (n *MyCustomNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
    // Your node logic here
    return map[string]any{
        "result": "success",
        "message": n.message,
    }, nil
}
```

#### Step 2: Add Auto-Registration

Add an `init()` function and registration function to your node:

```go
// Add to the same file: pkg/nodes/custom/mynode/mynode.go

// init registers the node type automatically on package import
func init() {
    nodes.RegisterNodeType(RegisterMyNode)
}

// RegisterMyNode registers the node type with the registry
func RegisterMyNode(reg *nodes.Registry) {
    reg.Register("mynode", func(execCtx plugin.ExecutionContext) plugin.Node {
        return NewMyCustomNode(execCtx)
    })
}
```

#### Step 3: Import Your Node Package

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
```

**That's it!** Your node will automatically register when the worker starts. No changes needed to `main.go` or any other files.

#### Complete Example

Here's a complete example of a simple logging node:

```go
// pkg/nodes/custom/log/log_node.go
package log

import (
    "context"
    "log/slog"
    "rune-worker/pkg/nodes"
    "rune-worker/plugin"
)

type LogNode struct {
    message string
}

func NewLogNode(execCtx plugin.ExecutionContext) *LogNode {
    node := &LogNode{
        message: "default log message",
    }
    
    if msg, ok := execCtx.Parameters["message"].(string); ok {
        node.message = msg
    }
    
    return node
}

func (n *LogNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
    slog.Info("log node executed", "message", n.message)
    
    return map[string]any{
        "logged": true,
        "message": n.message,
    }, nil
}

// Auto-registration
func init() {
    nodes.RegisterNodeType(RegisterLog)
}

func RegisterLog(reg *nodes.Registry) {
    reg.Register("log", func(execCtx plugin.ExecutionContext) plugin.Node {
        return NewLogNode(execCtx)
    })
}
```

#### How It Works

1. **Package Import**: When `pkg/registry` is imported, it triggers blank imports of all node packages
2. **Init Functions**: Each node package's `init()` function runs automatically
3. **Registration**: `nodes.RegisterNodeType()` adds the registration function to a global list
4. **Application**: `registry.InitializeRegistry()` calls all registered functions to populate the registry

#### Benefits

✅ **Automatic Discovery** - New nodes are found automatically  
✅ **Zero Configuration** - No manual registration lists  
✅ **Clean Separation** - Each node is self-contained  
✅ **Type Safety** - Compile-time verification  
✅ **Easy Testing** - Nodes can be tested independently

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
