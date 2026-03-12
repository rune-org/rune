#!/bin/sh
set -e

echo "Checking database migration status..."

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
    # alembic_version exists — check for pending migrations
    CURRENT=$(alembic current 2>/dev/null | head -1)
    HEAD=$(alembic heads 2>/dev/null | head -1)
    if [ "$CURRENT" != "$HEAD" ]; then
        echo ""
        echo "WARNING: Pending database migrations detected!"
        echo "  Current: $CURRENT"
        echo "  Head:    $HEAD"
        echo "  Run: docker exec -it rune-api alembic upgrade head"
        echo ""
    else
        echo "Database is up to date."
    fi
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
        echo ""
        echo "WARNING: Existing database detected without migration tracking!"
        echo "  Run the following to initialize tracking and apply pending migrations:"
        echo "    docker exec -it rune-api alembic stamp ba3dde446818"
        echo "    docker exec -it rune-api alembic upgrade head"
        echo ""
    else
        # Fresh DB — this is the only case where auto-migration is safe
        echo "Fresh database detected. Creating schema via migrations..."
        alembic upgrade head
        echo "Database schema created."
    fi
fi

# Start the application
exec "$@"
