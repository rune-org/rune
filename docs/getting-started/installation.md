# Installation Guide

This guide covers all installation methods for Rune, from quick Docker setup to full local development environments.

---

## Table of Contents

- [System Requirements](#system-requirements)
- [Docker Installation (Recommended)](#docker-installation-recommended)
- [Local Development Setup](#local-development-setup)
- [Hybrid Mode](#hybrid-mode)
- [Verifying Installation](#verifying-installation)
- [Troubleshooting](#troubleshooting)

---

## System Requirements

### Minimum Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **CPU** | 2 cores | 4+ cores |
| **RAM** | 4 GB | 8+ GB |
| **Storage** | 10 GB | 20+ GB |
| **OS** | Linux, macOS, Windows 10+ | Linux (Ubuntu 22.04+) |

### Software Dependencies

#### For Docker Installation
- Docker Desktop 4.0+ (or Docker Engine 24+ with Docker Compose v2)
- Git 2.30+

#### For Local Development
- Node.js 22+
- pnpm 9+
- Python 3.13+
- Go 1.25+
- PostgreSQL 15+
- Redis 7+
- RabbitMQ 3.12+

---

## Docker Installation (Recommended)

The Docker installation is the fastest and most reliable way to get started.

### Step 1: Clone the Repository

```bash
git clone https://github.com/rune-org/rune.git
cd rune
```

### Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env
```

Edit `.env` to customize your configuration:

```bash
# .env - Essential configuration

# Database
POSTGRES_USER=rune
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=rune_db

# RabbitMQ
RABBITMQ_USER=rune
RABBITMQ_PASSWORD=your_secure_password

# Security (IMPORTANT: Change in production!)
JWT_SECRET_KEY=your-super-secret-jwt-key-min-32-chars
ENCRYPTION_KEY=your-32-character-encryption-key
```

> ⚠️ **Security Note**: Always change the default passwords and secrets, especially for production deployments.

### Step 3: Start Services

```bash
# Start all services in detached mode
make up
```

This command starts:
- **Frontend** at `http://localhost:3000`
- **API** at `http://localhost:8000`
- **PostgreSQL** at `localhost:5432`
- **Redis** at `localhost:6379`
- **RabbitMQ** at `localhost:5672` (Management UI at `localhost:15672`)

### Step 4: Verify Installation

```bash
# Check all containers are running
make status

# View logs
make logs
```

You should see all services with status "Up".

### Docker Commands Reference

| Command | Description |
|---------|-------------|
| `make up` | Start all services |
| `make down` | Stop all services |
| `make restart` | Rebuild and restart |
| `make status` | Show container status |
| `make logs` | View all logs |
| `make logs-api` | View API logs only |
| `make logs-worker` | View worker logs only |
| `make logs-frontend` | View frontend logs only |
| `make db-shell` | Open PostgreSQL shell |
| `make docker-clean` | Remove all containers and volumes |

---

## Local Development Setup

For active development, running services locally provides faster iteration with hot reloading.

### Frontend (Next.js)

```bash
cd apps/web

# Enable corepack for pnpm
corepack enable

# Install dependencies
pnpm install

# Create local environment file
cp .env.example .env.local

# Start development server
pnpm dev
```

The frontend will be available at `http://localhost:3000`.

#### Frontend Environment Variables

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### API (FastAPI)

```bash
cd services/api

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env

# Run database migrations
alembic upgrade head

# Seed initial user (optional)
python -m scripts.seed_user

# Start development server with auto-reload
uvicorn src.app:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

#### API Environment Variables

```bash
# services/api/.env

# Database
DATABASE_URL=postgresql://rune:password@localhost:5432/rune_db

# Security
JWT_SECRET_KEY=your-development-secret-key
ENCRYPTION_KEY=your-32-character-encryption-key

# Redis
REDIS_URL=redis://localhost:6379/0

# RabbitMQ
RABBITMQ_URL=amqp://rune:password@localhost:5672/
```

### Worker (Go)

```bash
cd services/rune-worker

# Download dependencies
go mod download

# Create environment file
cp .env.example .env

# Run worker
go run cmd/worker/main.go
```

#### Worker Environment Variables

```bash
# services/rune-worker/.env

# RabbitMQ
RABBITMQ_URL=amqp://rune:password@localhost:5672/

# Redis
REDIS_URL=redis://localhost:6379/0

# Worker Settings
WORKFLOW_PREFETCH=10
WORKFLOW_CONCURRENCY=1
```

---

## Hybrid Mode

Hybrid mode runs infrastructure (databases, queues) in Docker while running application services locally. This is ideal for development.

### Start Infrastructure

```bash
# Start only infrastructure services
make api-dev
```

This starts PostgreSQL, Redis, and RabbitMQ in Docker.

### Run Services Locally

Open separate terminals for each service:

```bash
# Terminal 1: API
cd services/api
source .venv/bin/activate  # or .venv\Scripts\Activate.ps1 on Windows
uvicorn src.app:app --reload --port 8000

# Terminal 2: Frontend
cd apps/web
pnpm dev

# Terminal 3: Worker (optional)
cd services/rune-worker
go run cmd/worker/main.go
```

---

## Verifying Installation

### Health Checks

After starting services, verify each component:

```bash
# API Health
curl http://localhost:8000/health
# Expected: {"status": "healthy"}

# Frontend
curl -I http://localhost:3000
# Expected: HTTP/1.1 200 OK

# RabbitMQ Management
curl -u rune:password http://localhost:15672/api/overview
# Expected: JSON with RabbitMQ info
```

### Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Web application |
| API | http://localhost:8000 | REST API |
| API Docs (Swagger) | http://localhost:8000/docs | Interactive API docs |
| API Docs (ReDoc) | http://localhost:8000/redoc | API reference |
| RabbitMQ UI | http://localhost:15672 | Queue management |

### Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| Application | admin@example.com | admin123 |
| RabbitMQ | rune | rune_password |
| PostgreSQL | rune | rune_password |

> 🔒 Change these immediately in production!

---

## Troubleshooting

### Port Conflicts

If you see "port already in use" errors:

```bash
# Find what's using a port (Linux/macOS)
lsof -i :3000  # Frontend
lsof -i :8000  # API
lsof -i :5432  # PostgreSQL

# Windows (PowerShell)
Get-NetTCPConnection -LocalPort 3000
Get-NetTCPConnection -LocalPort 8000
```

### Docker Issues

```bash
# Reset everything
make down
docker volume prune -f
make up

# Rebuild images
make restart
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection
docker exec -it rune-postgres psql -U rune -d rune_db -c "SELECT 1"
```

### Permission Errors (Linux)

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Restart your session
logout
# Log back in
```

### Common Error Messages

| Error | Solution |
|-------|----------|
| `ECONNREFUSED` | Service not running. Check with `make status` |
| `relation does not exist` | Run migrations: `alembic upgrade head` |
| `invalid JWT token` | Check JWT_SECRET_KEY matches across services |
| `connection refused to RabbitMQ` | Wait for RabbitMQ to start (can take 30s) |

---

## Next Steps

Now that Rune is installed:

1. **[Quick Start](./quick-start.md)** - Learn the basics in 5 minutes
2. **[First Workflow](./first-workflow.md)** - Create your first automation
3. **[Configuration](../configuration/README.md)** - Customize your setup

---

[← Back to Getting Started](./README.md) | [Quick Start →](./quick-start.md)
