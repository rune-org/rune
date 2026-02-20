from typing import AsyncGenerator, Literal

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.config import Environment, Settings, get_settings

SETTINGS = get_settings()
_async_engine: AsyncEngine | None = None


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


async def init_db() -> None:
    """Initialize database by creating tables from SQLModel definitions.

    This automatically creates all tables on fresh installations.
    For schema updates on existing databases, use Alembic migrations manually:
        alembic upgrade head
    """
    import src.db.models  # noqa: F401

    async_engine = get_async_engine()
    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    print("Database initialized!")
