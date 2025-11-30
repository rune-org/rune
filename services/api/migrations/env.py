"""Alembic migrations environment configuration.

This module configures Alembic to work with SQLModel and async PostgreSQL.
Supports both online (connected to DB) and offline (SQL script generation) modes.
"""

import asyncio
import logging
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlmodel import SQLModel

from alembic import context

# Import all models to register them with SQLModel.metadata
# This must happen before target_metadata is set
import src.db.models  # noqa: F401

# Import database configuration utilities
from src.db.config import build_connection_string
from src.core.config import get_settings

# Alembic Config object - provides access to .ini file values
config = context.config

# Configure Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

logger = logging.getLogger("alembic.env")

# SQLModel metadata for autogenerate support
target_metadata = SQLModel.metadata


def get_database_url() -> str:
    """Build async database URL from application settings.

    Returns:
        PostgreSQL connection string with asyncpg driver.

    Raises:
        ValueError: If database configuration is incomplete.
    """
    settings = get_settings()

    if settings.database_url:
        db_url = settings.database_url
        # Ensure async driver
        if db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return db_url

    return build_connection_string(
        user=settings.postgres_user,
        password=settings.postgres_password,
        host=settings.postgres_host,
        port=settings.postgres_port,
        database=settings.postgres_db,
    )


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    Generates SQL scripts without connecting to the database.
    Useful for reviewing migrations before applying or for
    environments where direct DB access isn't available.

    Usage:
        alembic upgrade head --sql > migration.sql
    """
    url = get_database_url()

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Execute migrations within a transaction.

    Args:
        connection: SQLAlchemy database connection.
    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine.

    Creates an async database connection and runs migrations
    within a transaction. Uses NullPool to avoid connection
    pooling issues during migrations.
    """
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_database_url()

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


# Entry point - determine mode and run migrations
if context.is_offline_mode():
    logger.info("Running migrations in offline mode")
    run_migrations_offline()
else:
    logger.info("Running migrations in online mode")
    run_migrations_online()
