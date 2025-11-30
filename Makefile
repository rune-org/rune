.PHONY: help install dev build clean docker-up docker-up-nginx docker-down docker-build docker-clean logs test lint format typecheck web-dev web-lint web-format api-dev api-lint api-format worker-dev worker-lint worker-format worker-test up nginx-up down nginx-down restart restart-nginx status db-shell db-migrate db-rollback db-history db-current db-revision db-reset

# Default target
help:
	@echo "Rune - Low-code Workflow Automation Platform"
	@echo ""
	@echo "Available targets:"
	@echo "  make install       - Install all dependencies (frontend, API, worker)"
	@echo "  make dev           - Start all services in development mode"
	@echo "  make build         - Build all services"
	@echo "  make test          - Run tests for all services"
	@echo "  make lint          - Run linters for all services"
	@echo "  make format        - Format code for all services"
	@echo "  make typecheck     - Run type checking"
	@echo ""
	@echo "Frontend targets:"
	@echo "  make web-install   - Install frontend dependencies"
	@echo "  make web-dev       - Start frontend in dev mode"
	@echo "  make web-build     - Build frontend"
	@echo "  make web-lint      - Lint frontend code"
	@echo "  make web-format    - Format frontend code with prettier"
	@echo "  make web-typecheck - Type check frontend code"
	@echo ""
	@echo "API targets:"
	@echo "  make api-install   - Install API dependencies"
	@echo "  make api-dev       - Start API in dev mode"
	@echo "  make api-lint      - Lint API code with ruff"
	@echo "  make api-format    - Format API code with ruff"
	@echo ""
	@echo "Worker targets:"
	@echo "  make worker-install - Install worker dependencies"
	@echo "  make worker-dev     - Start worker in dev mode"
	@echo "  make worker-build   - Build worker"
	@echo "  make worker-lint    - Lint worker code"
	@echo "  make worker-format  - Format worker code"
	@echo "  make worker-test    - Run worker tests"
	@echo ""
	@echo "Database targets (run with venv activated):"
	@echo "  make db-migrate        - Apply all pending migrations"
	@echo "  make db-revision msg=x - Generate migration from model changes"
	@echo "  make db-rollback       - Rollback last migration"
	@echo "  make db-history        - Show migration history"
	@echo "  make db-current        - Show current DB version"
	@echo "  make db-reset          - Reset DB and run all migrations"
	@echo "  make db-shell          - Open PostgreSQL shell"
	@echo ""
	@echo "Docker targets:"
	@echo "  make up                        - Start all services (alias for docker-up)"
	@echo "  make up-nginx                  - Start all services on nginx proxy (alias for docker-up-nginx)"
	@echo "  make down                      - Stop all services (alias for docker-down)"
	@echo "  make restart                   - Restart all services (alias for docker-rebuild)"
	@echo "  make restart-nginx             - Restart services on nginx proxy (alias for docker-rebuild-nginx)"
	@echo "  make status                    - Show running containers status"
	@echo "  make logs                      - Show logs from all services"
	@echo ""
	@echo "  make docker-up        			- Start all services with Docker Compose"
	@echo "  make docker-up-nginx  			- Start all services on nginx proxy"
	@echo "  make docker-down      			- Stop all services"
	@echo "  make docker-build     			- Build all Docker images"
	@echo "  make docker-rebuild   			- Rebuild and restart all services"
	@echo "  make docker-rebuild-nginx   			- Rebuild and restart all services on nginx"
	@echo "  make docker-clean     			- Remove all containers, volumes, and images"
	@echo ""
	@echo "Cleanup targets:"
	@echo "  make clean         - Clean all build artifacts"
	@echo "  make clean-all     - Clean everything including dependencies"

# ======================
# Installation targets
# ======================

install: web-install api-install worker-install
	@echo "✓ All dependencies installed"

web-install:
	@echo "Installing frontend dependencies..."
	cd apps/web && pnpm install

api-install:
	@echo "Installing API dependencies..."
	cd services/api && pip install -r requirements.txt

worker-install:
	@echo "Installing worker dependencies..."
	cd services/rune-worker && go mod download

# ======================
# Development targets
# ======================

dev: docker-up web-dev
	@echo "All services started in development mode"

web-dev:
	@echo "Starting frontend in development mode..."
	cd apps/web && pnpm dev

api-dev:
	@echo "Starting API in development mode..."
	cd services/api && docker compose -f docker-compose.dev.yml up -d

worker-dev:
	@echo "Starting worker in development mode..."
	cd services/rune-worker && go run cmd/worker/main.go

# ======================
# Build targets
# ======================

build: web-build worker-build
	@echo "✓ All services built"

web-build:
	@echo "Building frontend..."
	cd apps/web && pnpm build

worker-build:
	@echo "Building worker..."
	cd services/rune-worker && go build -o bin/worker cmd/worker/main.go

# ======================
# Testing & Linting
# ======================

test: web-test worker-test
	@echo "✓ All tests passed"

web-test:
	@echo "Running frontend tests..."
	cd apps/web && pnpm test

worker-test:
	@echo "Running worker tests..."
	cd services/rune-worker && go test ./...

lint: web-lint api-lint worker-lint
	@echo "✓ Linting complete"

web-lint:
	@echo "Linting frontend..."
	cd apps/web && pnpm lint

web-format:
	@echo "Formatting frontend with prettier..."
	cd apps/web && pnpm dlx prettier --write .

api-lint:
	@echo "Linting API with ruff..."
	cd services/api && ruff check src/

api-format:
	@echo "Formatting API code with ruff..."
	cd services/api && ruff format src/

worker-lint:
	@echo "Linting worker..."
	cd services/rune-worker && go vet ./...
	cd services/rune-worker && go fmt ./...

worker-format:
	@echo "Formatting worker code..."
	cd services/rune-worker && go fmt ./...

format: web-format api-format worker-format
	@echo "✓ Code formatting complete"

typecheck: web-typecheck
	@echo "✓ Type checking complete"

web-typecheck:
	@echo "Type checking frontend..."
	cd apps/web && pnpm typecheck

# ======================
# Docker targets
# ======================

# Convenient aliases
up: docker-up

up-nginx: docker-up-nginx

down: docker-down

restart: docker-rebuild

restart-nginx: docker-rebuild-nginx

status:
	@echo "Docker containers status:"
	@docker compose ps

# Full docker commands
docker-up:
	@echo "Starting all services with Docker Compose..."
	docker compose up -d

docker-up-nginx:
	@echo "Starting on nginx..."
	docker compose -f docker-compose.nginx.yml up -d 

docker-down:
	@echo "Stopping all services..."
	docker compose down

docker-build:
	@echo "Building all Docker images..."
	docker compose build

docker-build-nginx:
	@echo "Building on nginx..."
	docker compose -f docker-compose.nginx.yml build

docker-rebuild: docker-down docker-build docker-up
	@echo "✓ All services rebuilt and restarted"

docker-rebuild-nginx: docker-down docker-build-nginx docker-up-nginx
	@echo "✓ All services rebuilt and restarted"

docker-clean:
	@echo "Cleaning up Docker resources..."
	docker compose down -v --rmi all

logs:
	docker compose logs -f

logs-api:
	docker compose logs -f api

logs-worker:
	docker compose logs -f worker

logs-frontend:
	docker compose logs -f frontend

# ======================
# Database targets
# ======================
# NOTE: Run these from services/api directory with venv activated:
#   cd services/api && source .venv/bin/activate  (Linux/Mac)
#   cd services/api && .\.venv\Scripts\activate   (Windows)

db-shell:
	docker exec -it rune-postgres psql -U rune -d rune_db

# Alembic Migration Commands (run from services/api with venv activated)
db-migrate:
	@echo "Applying all pending migrations..."
	alembic upgrade head

db-rollback:
	@echo "Rolling back last migration..."
	alembic downgrade -1
	
db-history:
	@echo "Migration history:"
	alembic history

db-current:
	@echo "Current database version:"
	alembic current

db-revision:
	@echo "Generating migration from model changes..."
	alembic revision --autogenerate -m "$(msg)"

db-reset:
	@echo "Resetting database (WARNING: destroys all data)..."
	docker compose -f docker-compose.dev.yml down -v
	docker compose -f docker-compose.dev.yml up -d
	@echo "Waiting for database to start..."
	@sleep 3
	alembic upgrade head
	@echo "✓ Database reset complete"

# ======================
# Cleanup targets
# ======================

clean:
	@echo "Cleaning build artifacts..."
	rm -rf apps/web/.next
	rm -rf apps/web/out
	rm -rf services/rune-worker/bin
	@echo "✓ Build artifacts cleaned"

clean-all: clean
	@echo "Cleaning all dependencies..."
	rm -rf apps/web/node_modules
	rm -rf apps/web/.pnpm-store
	@echo "✓ All dependencies cleaned"
