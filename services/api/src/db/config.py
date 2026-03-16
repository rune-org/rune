import asyncio
from pathlib import Path
from typing import AsyncGenerator, Literal

import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.config import Environment, Settings, get_settings

SETTINGS = get_settings()
_async_engine: AsyncEngine | None = None
_ALEMBIC_INI_PATH = Path(__file__).resolve().parents[2] / "alembic.ini"
_BASELINE_REVISION = "ba3dde446818"


def build_connection_string(
    user: str,
    password: str,
    host: str,
    port: int,
    database: str,
    driver: Literal["postgresql+asyncpg", "postgresql"] = "postgresql+asyncpg",
) -> str:
    """Build a database connection string from components.

    Args:
        user: Database user
        password: Database password
        host: Database host
        port: Database port
        database: Database name
        driver: Database driver (default: postgresql+asyncpg for SQLAlchemy,
                use 'postgresql' for psycopg)
    """
    return f"{driver}://{user}:{password}@{host}:{port}/{database}"


def create_database_engine(settings: Settings | None = None) -> AsyncEngine:
    if settings is None:
        settings = get_settings()

    # Ensure the database URL uses the async driver
    db_url = settings.database_url

    if db_url:
        if not db_url.startswith("postgresql+asyncpg://"):
            if db_url.startswith("postgresql://"):
                db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    else:
        # Build async URL from individual components
        db_url = build_connection_string(
            user=settings.postgres_user,
            password=settings.postgres_password,
            host=settings.postgres_host,
            port=settings.postgres_port,
            database=settings.postgres_db,
            driver="postgresql+asyncpg",
        )

    engine = create_async_engine(
        db_url,
        echo=(
            settings.environment == Environment.DEV
        ),  # Logs appear in terminal in dev mode
    )

    return engine


def get_async_engine() -> AsyncEngine:
    """Get the db async connection pool."""
    global _async_engine
    if _async_engine is None:
        _async_engine = create_database_engine()
    return _async_engine


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async_engine = get_async_engine()
    async with AsyncSession(async_engine, expire_on_commit=False) as async_session:
        yield async_session


def _get_alembic_config() -> Config:
    config = Config(str(_ALEMBIC_INI_PATH))
    config.set_main_option("script_location", str(_ALEMBIC_INI_PATH.parent / "migrations"))
    # Avoid clobbering app loggers when Alembic runs inside the FastAPI process.
    config.attributes["configure_logger"] = False
    return config


def _get_head_revisions(config: Config) -> set[str]:
    script = ScriptDirectory.from_config(config)
    return set(script.get_heads())


async def _table_exists(async_engine: AsyncEngine, table_name: str) -> bool:
    async with async_engine.connect() as conn:
        exists = await conn.scalar(
            sa.text(
                """
                SELECT EXISTS(
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = :table_name
                )
                """
            ),
            {"table_name": table_name},
        )
    return bool(exists)


async def _get_current_revisions(async_engine: AsyncEngine) -> set[str]:
    async with async_engine.connect() as conn:
        rows = await conn.execute(sa.text("SELECT version_num FROM alembic_version"))
    return {str(row[0]) for row in rows if row[0]}


async def _upgrade_to_head(config: Config) -> None:
    await asyncio.to_thread(command.upgrade, config, "head")


async def init_db() -> None:
    """Initialize database state and report migration status on startup."""

    async_engine = get_async_engine()
    async with async_engine.connect() as conn:
        await conn.execute(sa.text("SELECT 1"))

    print("Database connection verified!")

    alembic_config = _get_alembic_config()
    has_alembic_version = await _table_exists(async_engine, "alembic_version")

    if has_alembic_version:
        current_revisions = await _get_current_revisions(async_engine)
        head_revisions = _get_head_revisions(alembic_config)

        if current_revisions != head_revisions:
            print()
            print("WARNING: Pending database migrations detected!")
            print(f"  Current: {', '.join(sorted(current_revisions)) or 'none'}")
            print(f"  Head:    {', '.join(sorted(head_revisions)) or 'none'}")
            print("  Run: uv run alembic upgrade head")
            print("  Or:  docker exec -it rune-api alembic upgrade head")
            print()
        else:
            print("Database is up to date.")
        return

    has_workflows_table = await _table_exists(async_engine, "workflows")

    if has_workflows_table:
        print()
        print("WARNING: Existing database detected without migration tracking!")
        print("  This database may be in an inconsistent state for the current app version.")
        print("  Recommended: reset the database and restore from a clean, compatible backup.")
        print("  Fallback (use only if you understand the risks):")
        print("    This can hide schema drift and may cause runtime issues.")
        print("    To initialize migration tracking and apply pending migrations:")
        print(f"    uv run alembic stamp {_BASELINE_REVISION}")
        print("    uv run alembic upgrade head")
        print("  Or in Docker:")
        print(f"    docker exec -it rune-api alembic stamp {_BASELINE_REVISION}")
        print("    docker exec -it rune-api alembic upgrade head")
        print()
        return

    print("Fresh database detected. Creating schema via migrations...")
    await _upgrade_to_head(alembic_config)
    print("Database schema created.")
