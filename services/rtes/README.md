# RTES - Rune Token Execution Service

RTES is a microservice responsible for handling execution tokens and real-time events within the Rune ecosystem. It consumes token events from a message queue, stores them for validation, and provides real-time capabilities.

## Features

- **Token Consumption**: Consumes execution tokens from RabbitMQ (`execution.token` queue).
- **Token Storage**: Persists tokens in Redis for fast access and validation.
- **Real-time Events**: Built on `axum` for high-performance HTTP and WebSocket handling (WIP).
- **Observability**: Integrated OpenTelemetry (OTLP) for traces, metrics, and logs, exporting to [OpenObserve](https://openobserve.ai/).

## Tech Stack

- **Language**: Rust (2024 edition)
- **Web Framework**: [Axum](https://github.com/tokio-rs/axum)
- **Async Runtime**: [Tokio](https://tokio.rs/)
- **Messaging**: [Lapin](https://github.com/clevercloud/lapin) (RabbitMQ)
- **Storage**: [Redis](https://github.com/redis-rs/redis-rs)
- **Telemetry**: [OpenTelemetry](https://opentelemetry.io/) & [Tracing](https://github.com/tokio-rs/tracing)

## Configuration

The service is configured via environment variables.

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Connection string for Redis | `redis://127.0.0.1/` |
| `AMQP_URL` | Connection string for RabbitMQ | `amqp://127.0.0.1:5672/%2f` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Endpoint for OTLP exporter | `http://localhost:4317` |
| `PORT` | HTTP Server Port | `3000` (Hardcoded currently) |

## Getting Started

### Prerequisites

- Rust (latest stable)
- RabbitMQ
- Redis
- (Optional) OpenTelemetry Collector / Jaeger / Prometheus

### Running Locally

1. **Start Dependencies**:
   The project includes a `docker-compose.yml` file to spin up all necessary dependencies (Redis, RabbitMQ, OpenObserve, OpenTelemetry Collector).
   ```bash
   docker-compose up -d
   ```
   
   This will start:
   - **Redis**: `localhost:6379`
   - **RabbitMQ**: `localhost:5672` (Management UI: `localhost:15672`)
   - **OpenObserve**: `localhost:5080` (User: `admin@example.com`, Pass: `password`)
   - **OTEL Collector**: `localhost:4317`

2. **Run the Service**:
   ```bash
   cargo run
   ```

### Building for Production

```bash
cargo build --release
```

## Architecture

1. **Consumers**:
   - Tokens from `execution.token` → Redis (access control).
   - Node execution messages from `workflow.worker.initiated` → hydrate the execution document (workflow definition cached/upserted).
   - Node status messages from `workflow.node.status` → append to event log and hydrate per-node, per-lineage execution data.
2. **Storage**:
   - **Redis**: Execution token lookup.
   - **MongoDB**: `execution_status` (immutable event log) and `executions` (hydrated document keyed by `lineage_hash`).
3. **API**:
   - `GET /executions/:id` returns the hydrated execution document (inputs/params/outputs per lineage).
   - `GET /executions/:id/status` returns the raw status event stream.
   - `GET /executions/:id/result` returns workflow completion.
4. **WebSocket**:
   - `GET /ws?execution_id=...` broadcasts per-node deltas including `lineage_hash`, resolved params, and outputs.

## Operations

- **TTL / Retention**: Configure MongoDB TTL indexes to prevent unbounded growth, e.g. on `executions.updated_at` and `execution_status.executed_at` based on your retention policy.

## License

MIT
