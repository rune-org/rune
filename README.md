# Rune

Rune is a low‑code workflow automation platform that enables users to create, manage, and execute complex workflows through a visual interface.

## Repository Structure

```
rune/
├── apps/
│   └── web/              # Next.js frontend application
├── services/
│   ├── api/              # FastAPI backend service (Python)
│   └── rune-worker/      # Workflow worker service (Go)
├── docker-compose.yml    # Main Docker Compose configuration
└── Makefile
```

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript
- **API**: FastAPI, Python 3.13, PostgreSQL
- **Worker**: Go 1.25, RabbitMQ
- **Infrastructure**: Docker, PostgreSQL, Redis, RabbitMQ

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
# Start infrastructure (PostgreSQL, Redis, RabbitMQ)
make api-dev

# In separate terminals, run services locally:

# 1. Run API locally
cd services/api
source .venv/bin/activate  # or create venv: python -m venv .venv
pip install -r requirements.txt
uvicorn src.app:app --reload --port 8000

# 2. Run frontend locally
cd apps/web
pnpm install
pnpm dev

# 3 (optional).: Run worker locally
cd services/rune-worker
go run cmd/worker/main.go
```

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

### Frontend (Next.js)

```bash
cd apps/web
corepack enable
pnpm install
pnpm dev
```

**Requirements**: Node.js 22, pnpm 9

### API (FastAPI)

```bash
cd services/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run migrations and seed data
python -m scripts.seed_user

# Start server
uvicorn src.app:app --reload --port 8000
```

**Requirements**: Python 3.13+

### Worker (Go)

```bash
cd services/rune-worker
go mod download
go run cmd/worker/main.go
```

**Requirements**: Go 1.25+

## Available Make Commands

# Development
| Category | Command | Description |
|---|---|---|
| Development | `make install` | Install all dependencies |
| Development | `make dev` | Start all services in development mode |
| Development | `make build` | Build all services |
| Docker | `make up` | Start all services with Docker |
| Docker | `make down` | Stop all services |
| Docker | `make restart` | Rebuild and restart all services |
| Docker | `make status` | Show container status |
| Docker | `make logs` | View all logs |
| Testing & Quality | `make test` | Run all tests |
| Testing & Quality | `make lint` | Run linters for all services |
| Testing & Quality | `make format` | Format code for all services |
| Testing & Quality | `make typecheck` | Run type checking |
| Cleanup | `make clean` | Clean build artifacts |
| Cleanup | `make docker-clean` | Remove all Docker resources |

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

<!-- ## Contributing
TODO: CONTRIBUTING.md -->

## License

See [LICENSE](LICENSE) file for details.
