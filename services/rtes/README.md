# RTES - Rune Token Execution Service

RTES is a microservice responsible for handling executions and real-time events within the Rune ecosystem. It consumes events from a message queue, stores them for history retention, and provides real-time capabilities.

## API

- Realtime: `ws://localhost:8080/rt` (requires `Authorization: Bearer <token>`; also accepts `Authorization: token`)
- Execution lookup: `http://localhost:8080/executions/{execution_id}` (requires `Authorization: Bearer <token>`; also accepts `Authorization: token`)

- The realtime stream first loads every node state already persisted for the requested execution before relaying live updates that arrive afterwards, so clients immediately get the current graph followed by incremental events.

## Limitations

- **Split Node Executions**: Currently, split node executions (parallel branches/loops) are **not supported**. Any workflow utilizing these features will result in corrupted execution data within this service.

## Tech Stack

- **Language**: Rust (2024 edition)
- **Web Framework**: [Axum](https://github.com/tokio-rs/axum)
- **Async Runtime**: [Tokio](https://tokio.rs/)
- **Messaging**: [Lapin](https://github.com/clevercloud/lapin) (RabbitMQ)
- **Storage**: [Redis](https://github.com/redis-rs/redis-rs)
- **Telemetry**: [OpenTelemetry](https://opentelemetry.io/) & [Tracing](https://github.com/tokio-rs/tracing)

## License

MIT
