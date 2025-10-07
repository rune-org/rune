from typing import AsyncGenerator
from redis.asyncio import Redis

from src.core.config import get_settings


# Global Redis connection pool
_redis_client: Redis | None = None


def create_redis_client() -> Redis:
    settings = get_settings()

    return Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        db=settings.redis_db,
        password=settings.redis_password,
    )


def get_redis_client() -> Redis:
    global _redis_client

    if _redis_client is None:
        _redis_client = create_redis_client()

    return _redis_client


async def get_redis() -> AsyncGenerator[Redis, None]:
    yield get_redis_client()


async def close_redis() -> None:

    global _redis_client

    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
