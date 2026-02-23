.PHONY: help install dev build clean docker-up docker-up-nginx docker-down docker-build docker-clean logs test lint format typecheck web-dev web-lint web-format api-dev api-test dev-infra-up dev-infra-down test-infra-up test-infra-down api-install api-install-no-env api-lint api-format worker-dev worker-lint worker-format worker-test up nginx-up down nginx-down restart restart-nginx status

# Detect OS: try 'uname' for Unix, if that fails we're on Windows
UNAME := $(shell uname 2>/dev/null)
ifeq ($(UNAME),)
	DETECTED_OS := Windows
	VENV_ACTIVATE := venv\Scripts\activate
	PYTHON := python
	RM := rmdir /s /q
else
	DETECTED_OS := Unix
	VENV_ACTIVATE := . venv/bin/activate
	PYTHON := python3
	RM := rm -rf
endif

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
	@echo "  make api-install        - Install API dependencies (creates/uses venv)"
	@echo "  make api-install-no-env - Install API dependencies to system Python"
	@echo "  make api-dev            - Start FastAPI server in dev mode (hot-reload)"
	@echo "  make api-test           - Run API tests with pytest"
	@echo "  make api-lint           - Lint API code with ruff"
	@echo "  make api-format         - Format API code with ruff"
	@echo ""
	@echo "Development Infrastructure:"
	@echo "  make dev-infra-up       - Start shared infrastructure (postgres, redis, rabbitmq)"
	@echo "  make dev-infra-down     - Stop shared infrastructure"
	@echo "  Note: Run 'make dev-infra-up' before starting services"
	@echo ""
	@echo "Test Infrastructure:"
	@echo "  make test-infra-up      - Start test infrastructure (postgres, redis, rabbitmq for tests)"
	@echo "  make test-infra-down    - Stop test infrastructure"
	@echo "  Note: Run 'make test-infra-up' before running API tests"
	@echo ""
	@echo "Worker targets:"
	@echo "  make worker-install - Install worker dependencies"
	@echo "  make worker-dev     - Start worker in dev mode"
	@echo "  make worker-build   - Build worker"
	@echo "  make worker-lint    - Lint worker code"
	@echo "  make worker-format  - Format worker code"
	@echo "  make worker-test    - Run worker tests"
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
	@echo "Setting up API dependencies..."
ifeq ($(DETECTED_OS),Windows)
	@if not exist "services\api\venv" if not exist "services\api\.venv" (echo Creating virtual environment... && cd services\api && $(PYTHON) -m venv venv)
	@if exist "services\api\venv" (echo Using virtual environment: services\api\venv && cd services\api && call venv\Scripts\activate || (echo ❌ Failed to activate virtual environment && exit /b 1) && pip install -r requirements.txt && echo ✓ API dependencies installed) else if exist "services\api\.venv" (echo Using virtual environment: services\api\.venv && cd services\api && call .venv\Scripts\activate || (echo ❌ Failed to activate virtual environment && exit /b 1) && pip install -r requirements.txt && echo ✓ API dependencies installed) else (echo ❌ Error: No virtual environment found && echo For best results: cd services\api ^&^& python -m venv venv && exit /b 1)
else
	@if [ ! -d "services/api/venv" ] && [ ! -d "services/api/.venv" ]; then \
		echo "Creating virtual environment..."; \
		cd services/api && $(PYTHON) -m venv venv; \
	fi
	@if [ -d "services/api/venv" ]; then \
		echo "Using virtual environment: services/api/venv"; \
		cd services/api && . venv/bin/activate && pip install -r requirements.txt; \
		echo "✓ API dependencies installed"; \
	elif [ -d "services/api/.venv" ]; then \
		echo "Using virtual environment: services/api/.venv"; \
		cd services/api && . .venv/bin/activate && pip install -r requirements.txt; \
		echo "✓ API dependencies installed"; \
	else \
		echo "❌ Error: No virtual environment found and could not create one"; \
		echo ""; \
		echo "   For best results, create a virtual environment:"; \
		echo "   cd services/api && $(PYTHON) -m venv venv"; \
		echo ""; \
		echo "   If you need to install to system Python (not recommended), use:"; \
		echo "   make api-install-no-env"; \
		exit 1; \
	fi
endif

api-install-no-env:
	@echo "⚠️  Warning: This will install packages to your system Python"
	@echo "   For isolated dependencies, use 'make api-install' instead"
	@echo ""
ifeq ($(DETECTED_OS),Windows)
	@echo Installing API dependencies to system Python...
	cd services/api && pip install -r requirements.txt && echo ✓ API dependencies installed to system Python
else
	@read -p "Continue with system Python installation? [y/N]: " confirm && \
		if [ "$$confirm" != "y" ] && [ "$$confirm" != "Y" ]; then \
			echo "Installation cancelled."; \
			exit 0; \
		else \
			echo "Installing API dependencies to system Python..."; \
			cd services/api && pip install -r requirements.txt && \
			echo "✓ API dependencies installed to system Python"; \
		fi
endif

worker-install:
	@echo "Installing worker dependencies..."
	cd services/rune-worker && go mod download

# ======================
# Development targets
# ======================

dev: dev-infra-up
	@echo "Starting all services in development mode..."
	@$(MAKE) -j3 web-dev api-dev worker-dev

web-dev:
	@echo "Starting frontend in development mode..."
	cd apps/web && pnpm dev

dev-infra-up:
	@echo "Starting shared development infrastructure services..."
	cd services/api && docker compose -f docker-compose.dev.yml up -d

dev-infra-down:
	@echo "Stopping shared development infrastructure services..."
	cd services/api && docker compose -f docker-compose.dev.yml down

api-dev:
	@echo "Starting FastAPI server in development mode..."
ifeq ($(DETECTED_OS),Windows)
	@if exist "services\api\venv" (echo Using virtual environment: services\api\venv && echo Installing/updating dependencies... && cd services\api && call venv\Scripts\activate || (echo ❌ Failed to activate virtual environment && exit /b 1) && pip install -r requirements.txt && fastapi dev src\app.py) else if exist "services\api\.venv" (echo Using virtual environment: services\api\.venv && echo Installing/updating dependencies... && cd services\api && call .venv\Scripts\activate || (echo ❌ Failed to activate virtual environment && exit /b 1) && pip install -r requirements.txt && fastapi dev src\app.py) else (echo ⚠️  No virtual environment found. Using system Python. && echo For best results, install dependencies with: make api-install && cd services\api && fastapi dev src\app.py || (echo ❌ FastAPI not found. Please install dependencies: make api-install && exit /b 1))
else
	@if [ -d "services/api/venv" ] || [ -d "services/api/.venv" ]; then \
		echo "Using virtual environment: services/api/venv"; \
		echo "Installing/updating dependencies..."; \
		cd services/api && . venv/bin/activate && pip install -r requirements.txt && fastapi dev src/app.py; \
	else \
		echo "⚠️  No virtual environment found. Using system Python."; \
		echo "   For best results, install dependencies with: make api-install"; \
		cd services/api && fastapi dev src/app.py || (echo "❌ FastAPI not found. Please install dependencies: make api-install" && exit 1); \
	fi
endif

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

test: web-test api-test worker-test
	@echo "✓ All tests passed"

test-infra-up:
	@echo "Starting test infrastructure services..."
	cd services/api && docker compose -f docker-compose.test.yml up -d

test-infra-down:
	@echo "Stopping test infrastructure services..."
	cd services/api && docker compose -f docker-compose.test.yml down -v

web-test:
	@echo "Running frontend tests..."
	cd apps/web && pnpm test

worker-test:
	@echo "Running worker tests..."
	cd services/rune-worker && go test ./...

api-test:
	@echo "Running API tests..."
	@echo "Checking test infrastructure..."
ifeq ($(DETECTED_OS),Windows)
	@docker ps --filter "name=rune-api-postgres-test" --format "{{.Names}}" | findstr "rune-api-postgres-test" >nul && docker ps --filter "name=rune-api-redis-test" --format "{{.Names}}" | findstr "rune-api-redis-test" >nul && docker ps --filter "name=rune-api-rabbitmq-test" --format "{{.Names}}" | findstr "rune-api-rabbitmq-test" >nul || (echo ❌ Test infrastructure not running. && echo Please start test services with: make test-infra-up && exit /b 1)
	@if exist "services\api\venv" (echo Using virtual environment: services\api\venv && cd services\api && call venv\Scripts\activate || (echo ❌ Failed to activate virtual environment && exit /b 1) && pytest) else if exist "services\api\.venv" (echo Using virtual environment: services\api\.venv && cd services\api && call .venv\Scripts\activate || (echo ❌ Failed to activate virtual environment && exit /b 1) && pytest) else (echo ⚠️  No virtual environment found. Using system Python. && echo For best results, install dependencies with: make api-install && cd services\api && pytest || (echo ❌ pytest not found. Please install dependencies: make api-install && exit /b 1))
else
	@docker ps --filter "name=rune-api-postgres-test" --format "{{.Names}}" | grep -q "rune-api-postgres-test" && docker ps --filter "name=rune-api-redis-test" --format "{{.Names}}" | grep -q "rune-api-redis-test" && docker ps --filter "name=rune-api-rabbitmq-test" --format "{{.Names}}" | grep -q "rune-api-rabbitmq-test" || (echo "❌ Test infrastructure not running." && echo "   Please start test services with: make test-infra-up" && exit 1)
	@if [ -d "services/api/venv" ] || [ -d "services/api/.venv" ]; then \
		echo "Using virtual environment: services/api/venv"; \
		cd services/api && . venv/bin/activate && pytest; \
	else \
		echo "⚠️  No virtual environment found. Using system Python."; \
		echo "   For best results, install dependencies with: make api-install"; \
		cd services/api && pytest || (echo "❌ pytest not found. Please install dependencies: make api-install" && exit 1); \
	fi
endif

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
	@echo "Vetting code..."
	cd services/rune-worker && go vet ./...
	@echo "Checking code formatting..."
	@cd services/rune-worker && gofmt -l . | grep -q . && (echo "❌ Code formatting issues found. Run 'make worker-format' to fix." && gofmt -l . && exit 1) || echo "✓ Code formatting OK"

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

db-shell:
	docker exec -it rune-postgres psql -U rune -d rune_db

# ======================
# Cleanup targets
# ======================

clean:
	@echo "Cleaning build artifacts..."
	$(RM) apps/web/.next
	$(RM) apps/web/out
	$(RM) services/rune-worker/bin
	@echo "✓ Build artifacts cleaned"

clean-all: clean
	@echo "Cleaning all dependencies..."
	$(RM) apps/web/node_modules
	$(RM) apps/web/.pnpm-store
	@echo "✓ All dependencies cleaned"
