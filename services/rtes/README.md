# RTES - Rune Token Execution Service

RTES is a microservice responsible for handling executions and real-time events within the Rune ecosystem. It consumes events from a message queue, stores them for history retention, and provides real-time capabilities via WebSocket.

## Development Setup

### Prerequisites

1. **Rust** (1.70+): Install via [rustup](https://rustup.rs/)
2. **Docker**: For running backing services

### 1. Start Backing Services

From the `services/api` directory, start all required services:

```bash
cd services/api
docker-compose -f docker-compose.dev.yml up -d
```

This starts:
- PostgreSQL (for API)
- Redis (for token storage)
- RabbitMQ (for message queue)
- MongoDB (for execution history storage)

### 2. Configure Environment

Copy the example environment file and adjust if needed:

```bash
cp .env.example .env
```

Key environment variables:
- `REDIS_URL` - Redis connection string
- `AMQP_URL` - RabbitMQ connection string (credentials must match docker-compose)
- `MONGODB_URL` - MongoDB connection string
- `PORT` - HTTP server port (default: 3001)
- `RTES_SKIP_AUTH` - Set to `1` to bypass JWT authentication (dev only)

### 3. Run RTES

```bash
cargo run
```

RTES will:
1. Connect to Redis for token storage
2. Connect to MongoDB for execution history
3. Set up RabbitMQ exchange bindings automatically
4. Start consuming messages from queues
5. Start the HTTP/WebSocket server on the configured port

## API

### WebSocket (Real-time Updates)

```
ws://localhost:3001/rt?execution_id=<id>&workflow_id=<id>
```

In dev mode (with `RTES_SKIP_AUTH=1`), pass execution_id as a query parameter. In production, use `Authorization: Bearer <token>` header.

The WebSocket connection:
1. First sends all persisted node states for the execution
2. Then streams live updates as they arrive

### REST Endpoints

- `GET /executions/{execution_id}` - Get execution details

## Architecture

```
Worker → RabbitMQ (workflows exchange) → RTES → WebSocket → Frontend
                                            ↓
                                        MongoDB
```

RTES automatically binds the following queues to the `workflows` exchange on startup:
- `workflow.node.status` - Node execution status updates
- `workflow.completion` - Workflow completion events

## Tech Stack

- **Language**: Rust (2024 edition)
- **Web Framework**: [Axum](https://github.com/tokio-rs/axum)
- **Async Runtime**: [Tokio](https://tokio.rs/)
- **Messaging**: [Lapin](https://github.com/clevercloud/lapin) (RabbitMQ)
- **Token Storage**: [Redis](https://github.com/redis-rs/redis-rs)
- **Execution Storage**: [MongoDB](https://www.mongodb.com/)
- **Telemetry**: [OpenTelemetry](https://opentelemetry.io/) & [Tracing](https://github.com/tokio-rs/tracing)

## License

MIT
