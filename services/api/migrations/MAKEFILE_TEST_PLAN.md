# Test Plan: Makefile Database (Alembic) Targets

This document describes how to verify that the Makefile database migration targets work correctly. Run from the **repository root** with `make <target>`.

## Prerequisites

- **uv** installed ([install guide](https://github.com/astral-sh/uv)).
- API dependencies installed: `make api-install` (or `cd services/api && uv sync`).
- **Development database** running: `make dev-infra-up` (PostgreSQL must be up so Alembic can connect).

Optional: ensure `services/api/.env` (or env) has correct `POSTGRES_*` / `DATABASE_URL` for the dev database.

## Targets to Test

### 1. `make db-current`

- **Command:** `make db-current`
- **Expected:** Prints current Alembic revision (e.g. a revision ID) or "INFO  [alembic.runtime.migration] Context impl PostgresqlImpl." and no revision if at base. Exits 0.
- **Failure case:** If uv is missing, prints "uv not found" and exits non-zero.

### 2. `make db-history`

- **Command:** `make db-history`
- **Expected:** Lists migration history (revisions and descriptions). Exits 0.

### 3. `make db-upgrade`

- **Command:** `make db-upgrade`
- **Expected:** Applies all pending migrations. Output shows "Running upgrade ... -> ...". Running again should report no new migrations (already at head). Exits 0.

### 4. `make db-revision` (requires `msg`)

- **Command:** `make db-revision msg="test_migration"`
- **Expected:** Creates a new file under `services/api/migrations/versions/` with the given message. Exits 0.
- **Without msg:** `make db-revision` should print "Error: 'msg' parameter is required" and exit non-zero.
- **Cleanup:** Delete the generated file under `migrations/versions/` if it was only for testing, or leave it and roll back with `make db-downgrade` if it was applied.

### 5. `make db-downgrade`

- **Default (one step):** `make db-downgrade`
- **Expected:** Rolls back one revision. Output shows "Running downgrade ... -> ...". Exits 0.
- **To specific revision:** `make db-downgrade rev="<revision_id>"` (use an ID from `make db-history`).

### 6. `make db-reset`

- **Command:** `make db-reset`
- **Expected:**
  - Prints warning that the operation is destructive.
  - **Unix:** Prompts "Are you sure you want to continue? [y/N]:". Answering `n` or Enter cancels. Answering `y` runs downgrade base then upgrade head.
  - **Windows:** Prints that there is no confirmation prompt, then runs downgrade base and upgrade head.
  - After confirming (or on Windows), output shows downgrade then upgrade. Exits 0.
- **Caution:** Only run on a dev database; this removes all data.

### 7. `make db-shell`

- **Command:** `make db-shell`
- **Prerequisite:** Container `rune-postgres` must be running (e.g. after `make dev-infra-up`).
- **Expected:** Opens interactive `psql` in the rune database. Exit with `\q`.

## Quick smoke sequence (dev only)

1. `make dev-infra-up`
2. `make api-install`
3. `make db-current`   — see current revision
4. `make db-history`   — list migrations
5. `make db-upgrade`   — ensure at head
6. `make db-revision msg="smoke_test"` — create a migration file (do not apply if you want to avoid churn)
7. (Optional) Delete the new file in `migrations/versions/` if you did not run `db-upgrade` after step 6.

## Success criteria

- All commands run without errors when prerequisites are met.
- Missing `msg` for `db-revision` and missing `uv` produce clear error messages and non-zero exit.
- `db-reset` on Unix shows a confirmation prompt; on Windows it shows a warning and runs without prompt.
