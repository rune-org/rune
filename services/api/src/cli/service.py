"""
Service layer for CLI database operations.

Provides safe, read-only introspection plus admin-level data cleanup.
No raw SQL. No schema-dropping operations. The database structure is
managed exclusively through Alembic migrations.
"""

import time

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncEngine

from src.cli.schemas import (
    DBHealthResponse,
    DBTableData,
    DBTableInfo,
)
from src.db.config import get_async_engine


class CLIDBService:
    """Safe database operations for the RUNE CLI admin shell."""

    def __init__(self, engine: AsyncEngine | None = None) -> None:
        self._engine = engine or get_async_engine()

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------

    async def check_health(self) -> DBHealthResponse:
        """Run a comprehensive health check against the database."""
        start = time.monotonic()
        try:
            async with self._engine.connect() as conn:
                row = await conn.execute(sa.text("SELECT version()"))
                version = str(row.scalar() or "")

                latency = (time.monotonic() - start) * 1000

                row = await conn.execute(sa.text("SELECT current_database()"))
                db_name = str(row.scalar() or "")

                row = await conn.execute(
                    sa.text(
                        "SELECT pg_size_pretty("
                        "pg_database_size(current_database()))"
                    )
                )
                db_size = str(row.scalar() or "unknown")

                row = await conn.execute(
                    sa.text(
                        "SELECT COUNT(*) FROM information_schema.tables "
                        "WHERE table_schema = 'public'"
                    )
                )
                table_count = int(row.scalar() or 0)

                try:
                    row = await conn.execute(
                        sa.text('SELECT COUNT(*) FROM "users"')
                    )
                    user_count = int(row.scalar() or 0)
                except Exception:
                    user_count = -1

                try:
                    row = await conn.execute(
                        sa.text("SELECT COUNT(*) FROM workflows")
                    )
                    workflow_count = int(row.scalar() or 0)
                except Exception:
                    workflow_count = -1

            return DBHealthResponse(
                connected=True,
                version=version,
                database_name=db_name,
                database_size=db_size,
                table_count=table_count,
                user_count=user_count,
                workflow_count=workflow_count,
                latency_ms=round(latency, 2),
            )

        except Exception as exc:
            return DBHealthResponse(
                connected=False,
                version=str(exc),
            )

    # ------------------------------------------------------------------
    # Tables — read-only
    # ------------------------------------------------------------------

    async def list_tables(self) -> list[DBTableInfo]:
        """List all public tables with estimated row counts and sizes."""
        query = sa.text(
            """
            SELECT
                t.table_name,
                COALESCE(s.n_live_tup, 0) AS row_count,
                COALESCE(
                    pg_total_relation_size(
                        quote_ident(t.table_name)::regclass
                    ), 0
                ) AS size_bytes,
                COALESCE(
                    pg_size_pretty(
                        pg_total_relation_size(
                            quote_ident(t.table_name)::regclass
                        )
                    ),
                    '0 bytes'
                ) AS size_human
            FROM information_schema.tables t
            LEFT JOIN pg_stat_user_tables s
                ON t.table_name = s.relname
            WHERE t.table_schema = 'public'
              AND t.table_type = 'BASE TABLE'
            ORDER BY t.table_name
            """
        )
        async with self._engine.connect() as conn:
            result = await conn.execute(query)
            return [
                DBTableInfo(
                    name=row.table_name,
                    row_count=row.row_count,
                    size_bytes=row.size_bytes,
                    size_human=row.size_human,
                )
                for row in result
            ]

    async def get_table_data(
        self, table_name: str, limit: int = 100
    ) -> DBTableData:
        """Retrieve rows from *table_name* (limit capped at 500)."""
        limit = min(limit, 500)

        # Validate table name to prevent SQL injection
        tables = await self.list_tables()
        valid_names = {t.name for t in tables}
        if table_name not in valid_names:
            raise ValueError(f"Table '{table_name}' not found")

        async with self._engine.connect() as conn:
            count_result = await conn.execute(
                sa.text(f'SELECT COUNT(*) FROM "{table_name}"')  # noqa: S608
            )
            total = int(count_result.scalar() or 0)

            data_result = await conn.execute(
                sa.text(
                    f'SELECT * FROM "{table_name}" LIMIT :lim'  # noqa: S608
                ),
                {"lim": limit},
            )

            columns = list(data_result.keys())
            rows = [[str(cell) for cell in row] for row in data_result]

        return DBTableData(
            table_name=table_name,
            columns=columns,
            rows=rows,
            row_count=total,
        )

    # ------------------------------------------------------------------
    # Data cleanup — safe (schema is preserved)
    # ------------------------------------------------------------------

    async def truncate_table(self, table_name: str) -> None:
        """Truncate a single table (data only, schema untouched)."""
        tables = await self.list_tables()
        valid_names = {t.name for t in tables}
        if table_name not in valid_names:
            raise ValueError(f"Table '{table_name}' not found")

        # Protect migration tracking
        if table_name == "alembic_version":
            raise ValueError("Cannot truncate migration tracking table")

        async with self._engine.begin() as conn:
            await conn.execute(
                sa.text("SET session_replication_role = 'replica'")
            )
            await conn.execute(
                sa.text(
                    f'TRUNCATE TABLE "{table_name}" CASCADE'  # noqa: S608
                )
            )
            await conn.execute(
                sa.text("SET session_replication_role = 'origin'")
            )
