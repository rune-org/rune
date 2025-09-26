.PHONY: bootstrap install dev-web lint typecheck build test ci

bootstrap:
	@echo "Ensuring pnpm@9.0.0 is available..."
	@if command -v corepack >/dev/null 2>&1; then \
		corepack enable && corepack prepare pnpm@9.0.0 --activate; \
	else \
		if ! command -v pnpm >/dev/null 2>&1; then \
			echo "corepack not found; installing pnpm globally via npm"; \
			npm i -g pnpm@9.0.0; \
		fi; \
	fi
	@pnpm --version

install:
	@pnpm install
	@echo "Root lockfile generated/updated at pnpm-lock.yaml"

dev-web:
	@pnpm --filter web dev

lint:
	@pnpm lint

typecheck:
	@pnpm typecheck

build:
	@pnpm build

test:
	@pnpm test

ci: install lint typecheck build test
	@echo "Local CI run complete"

