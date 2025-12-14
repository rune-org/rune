# Rune

Rune is a low‑code workflow automation platform that enables users to create, manage, and execute complex workflows through a visual interface.

## Repository Structure

```
rune/
├── apps/
│   └── web/              # Next.js frontend application
├── services/
│   ├── api/              # FastAPI backend service (Python)
│   ├── rune-worker/      # Workflow worker service (Go)
│   └── scheduler/        # Standalone workflow scheduler (Python/Alpine)
├── docker-compose.yml    # Main Docker Compose configuration
└── Makefile
```

## Services at a Glance

| Component      | Responsibilities                                                           | Location               |
| -------------- | -------------------------------------------------------------------------- | ---------------------- |
| Frontend       | Visual workflow builder, run history UI, auth flows                        | `apps/web`             |
| API            | Workflow definitions, scheduling, user/org management, REST/GraphQL APIs   | `services/api`         |
| Scheduler      | Triggers scheduled workflows at specified intervals (standalone service)   | `services/scheduler`   |
| Worker         | Executes workflow steps, manages retries, interacts with external services | `services/rune-worker` |
| Infrastructure | Shared dependencies: PostgreSQL, Redis, RabbitMQ, MinIO (optional)         | `docker-compose.yml`   |

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript
- **API**: FastAPI, Python 3.13, PostgreSQL
- **Worker**: Go 1.25, RabbitMQ
- **Infrastructure**: Docker, PostgreSQL, Redis, RabbitMQ

## Key Capabilities

- **Visual workflow designer** for composing multi-step automations with branching logic, retry policies, and scheduling.
- **Reusable integration blocks** for common SaaS tools (HTTP, queues, databases) that can be combined into new workflows quickly.
- **Observability first**: central run history, live logs, and per-step metrics to debug production runs without diving into logs manually.
- **Environment aware deployments** so you can promote workflows from staging to production with consistent secrets and infra settings.

## Quick Start (Docker - Recommended)

The fastest way to get started is using Docker, which runs all services in containers.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Docker Compose)
- Git

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/rune-org/rune.git
cd rune

# 2. Copy environment file
cp .env.example .env

# 3. Start all services
make up

# 4. Access the application
- Frontend: http://localhost:3000
- API: http://localhost:8000
- RabbitMQ Management: http://localhost:15672
```

### Common Docker Commands

```bash
make up          # Start all services
make down        # Stop all services
make restart     # Rebuild and restart all services
make status      # Show container status
make logs        # View logs from all services

# Service-specific logs
make logs-api
make logs-worker
make logs-frontend

# Database access
make db-shell    # Connect to PostgreSQL

# Cleanup
make docker-clean   # Remove all containers, volumes, and images
docker image prune  # Remove dangling images
```

## Development Modes

### 1. Full Docker (Recommended for Testing)

Run everything in Docker containers. Great for testing the complete system.

```bash
make up
```

### 2. Hybrid Mode (Recommended for Development)

Run infrastructure in Docker, but run services locally for faster development.

```bash
# 1. Install all dependencies (first time only)
make install

# 2. Start shared Docker infrastructure (required before running services)
make dev-infra-up

# In separate terminals, run services locally:

# 3. Run frontend locally
make web-dev

# 4. Run API locally
make api-dev

# 5. (Optional) Run worker locally
make worker-dev
```

**Note**: The shared infrastructure (PostgreSQL, Redis, RabbitMQ) must be started with `make dev-infra-up` before running any services. Stop it with `make dev-infra-down` when done.

## Environment Configuration

### Main Environment Variables (`.env`)

```bash
# Database
POSTGRES_USER=rune
POSTGRES_PASSWORD=rune_password
POSTGRES_DB=rune_db

# RabbitMQ
RABBITMQ_USER=rune
RABBITMQ_PASSWORD=rune_password

# API Settings
JWT_SECRET_KEY=your-secret-key-here
ENCRYPTION_KEY=your-encryption-key-here

# Worker Settings
WORKFLOW_PREFETCH=10
WORKFLOW_CONCURRENCY=1
```

### Service-Specific Configuration

Each service has its own `.env` file for local development:

- `services/api/.env` - API configuration
- `services/rune-worker/.env` - Worker configuration
- `apps/web/.env.local` - Frontend configuration

## Local Development Setup

If you prefer to run services locally without Docker:

**Prerequisite**: Start the shared infrastructure first with `make dev-infra-up` (PostgreSQL, Redis, RabbitMQ).

### Frontend (Next.js)

```bash
# Install dependencies (first time only)
make web-install

# Start development server
make web-dev
```

**Requirements**: Node.js 22, pnpm 9

### API (FastAPI)

```bash
# Install dependencies (creates venv automatically)
make api-install

# Run migrations and seed data (if needed)
cd services/api
source venv/bin/activate  # or .venv/bin/activate
python -m scripts.seed_user

# Start server
make api-dev
```

**Requirements**: Python 3.13+

**Note**: If you prefer to install to system Python instead of a virtual environment, use `make api-install-no-env` (not recommended).

### Worker (Go)

```bash
# Install dependencies (first time only)
make worker-install

# Start worker
make worker-dev
```

**Requirements**: Go 1.25+

## Available Make Commands

### Development

| Command        | Description                                      |
| -------------- | ------------------------------------------------ |
| `make install` | Install all dependencies (frontend, API, worker) |
| `make dev`     | Start all services in development mode           |
| `make build`   | Build all services                               |

### Frontend

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `make web-install`   | Install frontend dependencies      |
| `make web-dev`       | Start frontend in development mode |
| `make web-build`     | Build frontend                     |
| `make web-lint`      | Lint frontend code                 |
| `make web-format`    | Format frontend code with prettier |
| `make web-typecheck` | Type check frontend code           |

### API

| Command                   | Description                                   |
| ------------------------- | --------------------------------------------- |
| `make api-install`        | Install API dependencies (creates/uses venv)  |
| `make api-install-no-env` | Install API dependencies to system Python     |
| `make api-dev`            | Start FastAPI server in dev mode (hot-reload) |
| `make api-lint`           | Lint API code with ruff                       |
| `make api-format`         | Format API code with ruff                     |

### Development Infrastructure

| Command               | Description                                             |
| --------------------- | ------------------------------------------------------- |
| `make dev-infra-up`   | Start shared infrastructure (postgres, redis, rabbitmq) |
| `make dev-infra-down` | Stop shared infrastructure                              |

### Worker

| Command               | Description                      |
| --------------------- | -------------------------------- |
| `make worker-install` | Install worker dependencies      |
| `make worker-dev`     | Start worker in development mode |
| `make worker-build`   | Build worker                     |
| `make worker-lint`    | Lint worker code                 |
| `make worker-format`  | Format worker code               |
| `make worker-test`    | Run worker tests                 |

### Docker

| Command              | Description                      |
| -------------------- | -------------------------------- |
| `make up`            | Start all services with Docker   |
| `make down`          | Stop all services                |
| `make restart`       | Rebuild and restart all services |
| `make status`        | Show container status            |
| `make logs`          | View all logs                    |
| `make logs-api`      | View API logs                    |
| `make logs-worker`   | View worker logs                 |
| `make logs-frontend` | View frontend logs               |
| `make db-shell`      | Connect to PostgreSQL            |
| `make docker-clean`  | Remove all Docker resources      |

### Testing & Quality

| Command          | Description                  |
| ---------------- | ---------------------------- |
| `make test`      | Run all tests                |
| `make lint`      | Run linters for all services |
| `make format`    | Format code for all services |
| `make typecheck` | Run type checking            |

### Cleanup

| Command          | Description                             |
| ---------------- | --------------------------------------- |
| `make clean`     | Clean build artifacts                   |
| `make clean-all` | Clean everything including dependencies |

## Troubleshooting

### Port Conflicts

If you get port binding errors, check if ports are already in use:

```bash
# Check what's using a port
lsof -i :3000  # Frontend
lsof -i :8000  # API
lsof -i :5432  # PostgreSQL
```

### Database Connection Issues

```bash
# Reset the database
make down
docker volume rm rune_postgres_data
make up
```

## Contributing

New issues, feature proposals, and pull requests are very welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for the full development workflow, coding standards, and commit message conventions.

## License

See [LICENSE](LICENSE) file for details.
