# Rune Workflow Worker

A pluggable, message-driven workflow execution engine built on RabbitMQ. The worker implements recursive node-by-node execution, processing workflows defined in a declarative DSL format.

## ✨ Features

- **🔄 Recursive Execution**: Node-by-node execution with context accumulation
- **🔀 Conditional Branching**: Support for conditional and split nodes
- **🔐 Credential Management**: Secure credential passing from master service
- **🛡️ Error Handling**: Configurable strategies (halt, ignore, branch)
- **📡 Real-time Status**: Live status messages for workflow monitoring
- **⚡ Fault Tolerance**: At-least-once delivery through message acknowledgments
- **🔌 Extensible**: Plugin architecture for custom node types
- **📊 Context Accumulation**: Results stored with `$<node_name>` keys

## 🚀 Quick Start

### Prerequisites

- Go 1.24+
- RabbitMQ (default: localhost:5672)
- Redis (for state management)
- Docker (optional)

### Installation

```bash
# Clone and navigate to the project
cd services/rune-worker

# Install dependencies
go mod download

# Build the worker
go build -o worker cmd/worker/main.go

# Run the worker
./worker
```

For detailed setup instructions, see [Getting Started](docs/GETTING_STARTED.md).

## 📖 Documentation

### Core Documentation
- **[Getting Started](docs/GETTING_STARTED.md)** - Installation, configuration, and first workflow
- **[Architecture](docs/ARCHITECTURE.md)** - System design, components, and message flow
- **[Workflow DSL](docs/WORKFLOW_DSL.md)** - Workflow definition language and examples
- **[Node Types](docs/NODE_TYPES.md)** - Built-in node types and their usage

### Developer Guides
- **[Testing](docs/TESTING.md)** - Running unit, integration, and E2E tests
- **[Custom Nodes](docs/CUSTOM_NODES.md)** - Creating custom node types
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

### Additional Resources
- **[RabbitMQ Flow Diagram](docs/RABBITMQ_FLOW_DIAGRAM.md)** - Message flow visualization
- **[RFC-001](rfcs/RFC-001-recursive-executor.md)** - Recursive execution architecture
- **[RFC-002](rfcs/RFC-002-workflow-dsl.md)** - DSL specification

## 🏗️ Project Structure

```
cmd/worker/          Application entrypoint
pkg/
  ├── core/          Core workflow types and interfaces
  ├── dsl/           DSL parsing and validation
  ├── executor/      Recursive executor implementation
  ├── messaging/     RabbitMQ consumer and publisher
  ├── nodes/         Built-in node registry
  │   └── custom/    Custom node implementations
  ├── messages/      Message type definitions
  ├── platform/      Infrastructure (config, queue)
  └── registry/      Auto-registration system
plugin/              Public API for custom nodes
e2e/                 End-to-end tests
integration/         Integration tests
rfcs/                Architecture specifications
docs/                Documentation
```

## 🧪 Running Tests

```bash
# Quick test (unit tests only)
./scripts/run_tests.py unit

# Integration tests (requires RabbitMQ & Redis)
./scripts/run_tests.py integration --start-services

# E2E tests
./scripts/run_tests.py e2e --start-services

# All tests
./scripts/run_tests.py all --start-services -v
```

See [Testing Guide](docs/TESTING.md) for comprehensive testing documentation.

## 📝 Example Workflow

```json
{
  "id": "user_workflow",
  "name": "User Validation Workflow",
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
      "name": "CheckStatus",
      "type": "conditional",
      "parameters": {
        "condition": "{{$fetch_user.status}} == 'active'",
        "true_edge_id": "send_welcome",
        "false_edge_id": "notify_admin"
      }
    },
    {
      "id": "send_welcome",
      "name": "SendWelcome",
      "type": "http",
      "parameters": {
        "method": "POST",
        "url": "https://api.example.com/emails/welcome",
        "body": {"email": "{{$fetch_user.email}}"}
      }
    }
  ],
  "edges": [
    {"id": "e1", "src": "fetch_user", "dst": "check_status"},
    {"id": "e2", "src": "check_status", "dst": "send_welcome"},
    {"id": "e3", "src": "check_status", "dst": "notify_admin"}
  ]
}
```

More examples in [Workflow DSL Documentation](docs/WORKFLOW_DSL.md).

## 🔌 Built-in Node Types

- **HTTP Node** - Make REST API calls with retry and timeout
- **Log Node** - Debug logging with template interpolation
- **Conditional Node** - Branch based on conditions
- **Split Node** - Parallel execution paths

See [Node Types Documentation](docs/NODE_TYPES.md) for complete reference.

## 🛠️ Creating Custom Nodes

```go
package mynode

import (
    "context"
    "rune-worker/pkg/nodes"
    "rune-worker/plugin"
)

type MyNode struct {
    message string
}

func (n *MyNode) Execute(ctx context.Context, execCtx plugin.ExecutionContext) (map[string]any, error) {
    // Your implementation
    return map[string]any{"result": "success"}, nil
}

func init() {
    nodes.RegisterNodeType(RegisterMyNode)
}
```

See [Custom Nodes Guide](docs/CUSTOM_NODES.md) for complete implementation details.

## 🤝 Contributing

Contributions are welcome! Please:

1. Check existing issues or create a new one
2. Fork the repository and create a feature branch
3. Write tests for your changes
4. Ensure all tests pass: `./scripts/run_tests.py all`
5. Submit a pull request

## 📄 License

See LICENSE file in the repository root.

## 🔗 Related Projects

- **Rune Master Service** - Workflow orchestration and management
- **Rune Dashboard** - Web UI for workflow monitoring
- **Rune CLI** - Command-line workflow tools

---

**Need Help?** Check the [Troubleshooting Guide](docs/TROUBLESHOOTING.md) or open an issue.

