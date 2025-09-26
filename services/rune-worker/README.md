# Workflow Worker

This project provides a pluggable worker service for executing workflows driven by messages from RabbitMQ. The layout separates the core components into dedicated packages for DSL parsing, node execution, consumers, and queue management.

## Structure

- `cmd/worker`: Application entrypoint.
- `pkg/consumers`: Message consumer logic.
- `pkg/dsl`: DSL parsing, validation, and graph analysis.
- `pkg/executor`: Step execution framework.
- `pkg/nodes`: Built-in node registry and default implementations.
- `pkg/queue`: RabbitMQ connectivity helpers.
- `plugin`: Public API for third-party node implementations.

## Getting Started

1. Ensure you have Go 1.25 or newer installed.
2. Copy `.env` and adjust the RabbitMQ URL or queue settings as needed.
3. Install dependencies and run a build:

```sh
cd rune-worker
go mod tidy
go build ./...
```

Extend the DSL types, executor logic, and node implementations to model your workflows. Use the `plugin` package as the contract for custom nodes.
