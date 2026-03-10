# Rune Workflow Scheduler

Standalone service that polls PostgreSQL for due scheduled workflows and publishes them to RabbitMQ for execution by the worker.

## How it works

1. Every `SCHEDULER_POLL_INTERVAL` seconds, query `scheduled_workflows` for rows where `is_active = true` and `next_run_at` is within the look-ahead window
2. For each due schedule, resolve node credentials from the database and publish a workflow execution message to RabbitMQ
3. Advance `next_run_at` by `interval_seconds`

## Running

### Local development

```bash
# Requires dev infrastructure (postgres, rabbitmq)
make dev-infra-up
make scheduler-dev
```

`make scheduler-dev` sources `services/api/.env` for the `ENCRYPTION_KEY` and DB credentials.

### Docker (production)

The scheduler is included in the root `docker-compose.yml` and starts automatically with `make up`.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_DB` | `rune_db` | Database name |
| `POSTGRES_USER` | `rune` | Database user |
| `POSTGRES_PASSWORD` | `rune_password` | Database password |
| `RABBITMQ_HOST` | `localhost` | RabbitMQ host |
| `RABBITMQ_PORT` | `5672` | RabbitMQ port |
| `RABBITMQ_USER` | `rune` | RabbitMQ user |
| `RABBITMQ_PASSWORD` | `rune_password` | RabbitMQ password |
| `RABBITMQ_QUEUE` | `workflow.execution` | Queue name |
| `ENCRYPTION_KEY` | — | Fernet key for credential decryption (must match API) |
| `SCHEDULER_POLL_INTERVAL` | `30` | Poll interval in seconds |
| `SCHEDULER_LOOK_AHEAD` | `60` | Look-ahead window in seconds |
| `LOG_LEVEL` | `INFO` | Logging level |
