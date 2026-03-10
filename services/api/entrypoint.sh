#!/bin/sh
set -e

echo "Running database migrations..."

# Check if alembic_version table exists (i.e., migrations have been used before)
if python -c "
import asyncio, asyncpg, os
from src.core.config import get_settings
s = get_settings()
async def check():
    conn = await asyncpg.connect(
        user=s.postgres_user, password=s.postgres_password,
        host=s.postgres_host, port=s.postgres_port, database=s.postgres_db
    )
    row = await conn.fetchval(
        \"SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='alembic_version')\"
    )
    await conn.close()
    return row
exit(0 if asyncio.run(check()) else 1)
" 2>/dev/null; then
    # alembic_version exists — run pending migrations normally
    echo "Alembic tracking found. Running pending migrations..."
    alembic upgrade head
else
    # No alembic_version table — check if this is an existing DB or a fresh one
    if python -c "
import asyncio, asyncpg
from src.core.config import get_settings
s = get_settings()
async def check():
    conn = await asyncpg.connect(
        user=s.postgres_user, password=s.postgres_password,
        host=s.postgres_host, port=s.postgres_port, database=s.postgres_db
    )
    row = await conn.fetchval(
        \"SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='workflows')\"
    )
    await conn.close()
    return row
exit(0 if asyncio.run(check()) else 1)
" 2>/dev/null; then
        # Existing DB with tables but no alembic tracking — stamp it
        echo "Existing database detected without migration tracking. Stamping current state..."
        alembic stamp head
    else
        # Fresh DB — let alembic create everything
        echo "Fresh database detected. Creating schema via migrations..."
        alembic upgrade head
    fi
fi

echo "Database migrations complete."

# Start the application
exec "$@"
