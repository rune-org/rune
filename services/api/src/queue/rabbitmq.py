from typing import AsyncGenerator
from aio_pika import connect_robust, RobustConnection

from src.core.config import get_settings


# Global RabbitMQ connection pool (singleton pattern)
_rabbitmq_connection: RobustConnection | None = None


def build_rabbitmq_url(
    host: str,
    port: int,
    username: str,
    password: str,
) -> str:
    """Build a RabbitMQ connection URL from components."""
    return f"amqp://{username}:{password}@{host}:{port}/"


async def create_rabbitmq_connection() -> RobustConnection:
    """
    Create a new RabbitMQ connection.

    Returns:
        RobustConnection: A robust connection that auto-reconnects on failure
    """
    settings = get_settings()

    rabbitmq_url = settings.rabbitmq_url
    if not rabbitmq_url:
        rabbitmq_url = build_rabbitmq_url(
            host=settings.rabbitmq_host,
            port=settings.rabbitmq_port,
            username=settings.rabbitmq_username,
            password=settings.rabbitmq_password,
        )

    connection = await connect_robust(rabbitmq_url)
    return connection


async def get_rabbitmq_connection() -> RobustConnection:
    """
    Get or create the global RabbitMQ connection (singleton).

    Returns:
        RobustConnection: The global connection instance
    """
    global _rabbitmq_connection

    if _rabbitmq_connection is None or _rabbitmq_connection.is_closed:
        _rabbitmq_connection = await create_rabbitmq_connection()

    return _rabbitmq_connection


async def get_rabbitmq() -> AsyncGenerator[RobustConnection, None]:
    """
    FastAPI dependency to inject RabbitMQ connection.

    Yields:
        RobustConnection: The active RabbitMQ connection
    """
    yield await get_rabbitmq_connection()


async def close_rabbitmq() -> None:
    """
    Close the global RabbitMQ connection.

    Called during application shutdown to ensure graceful cleanup.
    """
    global _rabbitmq_connection

    if _rabbitmq_connection is not None and not _rabbitmq_connection.is_closed:
        await _rabbitmq_connection.close()
        _rabbitmq_connection = None
