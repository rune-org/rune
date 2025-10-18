import asyncio
import os
import pytest
import pytest_asyncio
from typing import AsyncGenerator
from httpx import ASGITransport, AsyncClient
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from redis.asyncio import Redis

from src.app import app
from src.core.config import Settings, get_settings
from src.db.config import create_database_engine, get_db
from src.db.redis import get_redis_client, get_redis


# Session-scoped event loop for session-scoped async fixtures
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# Override settings for tests
@pytest.fixture(scope="session")
def test_settings() -> Settings:
    """Load test settings from .env.test file."""
    # Load environment variables from .env.test
    from dotenv import load_dotenv
    load_dotenv(".env.test", override=True)
    
    return Settings()


@pytest.fixture(scope="session", autouse=True)
def override_settings(test_settings: Settings):
    """Override the app settings with test settings."""
    # Clear the lru_cache so our test settings are used
    get_settings.cache_clear()
    
    app.dependency_overrides[get_settings] = lambda: test_settings
    yield
    
    # Clean up
    app.dependency_overrides.clear()
    get_settings.cache_clear()


@pytest_asyncio.fixture(scope="session")
async def test_engine(test_settings: Settings):
    """
    Create a database engine for the test session.
    Tables are created once at the start and dropped at the end.
    """
    engine = create_database_engine(test_settings)
    
    # Create all tables once for the session
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    
    yield engine
    
    # Clean up: drop all tables after all tests
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
    
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def test_db(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """
    Create a fresh database session for each test.
    The session is rolled back after each test to ensure isolation.
    """
    connection = await test_engine.connect()
    transaction = await connection.begin()
    
    session = AsyncSession(bind=connection, expire_on_commit=False)
    
    yield session
    
    await session.close()
    await transaction.rollback()
    await connection.close()


@pytest_asyncio.fixture(scope="function")
async def test_redis(test_settings: Settings) -> AsyncGenerator[Redis, None]:
    """
    Create a fresh Redis client for each test.
    Flushes the test database before and after each test.
    """
    redis_client = Redis(
        host=test_settings.redis_host,
        port=test_settings.redis_port,
        db=test_settings.redis_db,
        decode_responses=False,
    )
    
    # Clear Redis before test
    await redis_client.flushdb()
    
    yield redis_client
    
    # Clear Redis after test
    await redis_client.flushdb()
    await redis_client.aclose()


@pytest_asyncio.fixture(scope="function")
async def client(
    test_db: AsyncSession,
    test_redis: Redis,
) -> AsyncGenerator[AsyncClient, None]:
    """
    Create an async HTTP client for testing API endpoints.
    Overrides database and Redis dependencies with test instances.
    """
    
    async def override_get_db():
        yield test_db
    
    async def override_get_redis():
        yield test_redis
    
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis_client] = lambda: test_redis
    
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client
    
    # Clean up overrides
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_redis_client, None)
