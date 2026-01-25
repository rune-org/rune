# RTES - Real Time Execution Service

RTES is a microservice responsible for handling executions and real-time events within the Rune ecosystem. It consumes events from a message queue, stores them in MongoDB for history retention, and provides real-time capabilities via WebSocket.

## API

All endpoints require `Authorization: Bearer <jwt_token>` header (also accepts `Authorization: <token>` directly).

- **Real-time WebSocket**: `ws://localhost:8080/rt?execution_id={execution_id}&workflow_id={workflow_id}`
- **Get execution**: `GET http://localhost:8080/executions/{execution_id}`
- **List workflow executions**: `GET http://localhost:8080/workflows/{workflow_id}/executions`

The WebSocket stream first loads every node state already persisted for the requested execution before relaying live updates that arrive afterwards, so clients immediately get the current graph followed by incremental events.

## Authorization

Before accessing any endpoint, the API service must publish an `ExecutionToken` to the `execution.token` RabbitMQ queue:

```json
{
  "user_id": "user-uuid",
  "workflow_id": "workflow-uuid",
  "execution_id": "exec-uuid-or-null",
  "iat": 1702857600,
  "exp": 1702861200
}
```

Set `execution_id` to `null` for wildcard access to all executions within a workflow.

## Limitations

- **Split Node Executions**: Currently, split node executions (parallel branches/loops) are **not supported**. Any workflow utilizing these features will result in corrupted execution data within this service.

## Tech Stack

- **Language**: Rust (2024 edition)
- **Web Framework**: [Axum](https://github.com/tokio-rs/axum)
- **Async Runtime**: [Tokio](https://tokio.rs/)
- **Messaging**: [Lapin](https://github.com/clevercloud/lapin) (RabbitMQ)
- **Storage**: [MongoDB](https://www.mongodb.com/) & [Redis](https://github.com/redis-rs/redis-rs)
- **Telemetry**: [OpenTelemetry](https://opentelemetry.io/) & [Tracing](https://github.com/tokio-rs/tracing)

## License

MIT
