"""Database connection pool management."""

import asyncio
import asyncpg
import logging
from typing import Optional

from config import Config


logger = logging.getLogger("scheduler.database")


class DatabasePool:
    """Manages PostgreSQL connection pool with automatic reconnection."""

    def __init__(self, dsn: str, max_retries: int = 5):
        """
        Initialize database pool manager.

        Args:
            dsn: PostgreSQL connection string
            max_retries: Maximum connection attempts
        """
        self.dsn = dsn
        self.max_retries = max_retries
        self.pool: Optional[asyncpg.Pool] = None
        self.min_pool_size = Config.DB_POOL_MIN_SIZE
        self.max_pool_size = Config.DB_POOL_MAX_SIZE

    async def connect(self) -> asyncpg.Pool:
        """Establish database connection with retry logic."""
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info(
                    f"Connecting to database (attempt {attempt}/{self.max_retries})..."
                )
                self.pool = await asyncpg.create_pool(
                    self.dsn,
                    min_size=self.min_pool_size,
                    max_size=self.max_pool_size,
                    command_timeout=60,
                    server_settings={"application_name": "rune-scheduler"},
                )
                logger.info(
                    f"Database connection pool established (min={self.min_pool_size}, max={self.max_pool_size})"
                )
                return self.pool
            except Exception as e:
                logger.error(f"Database connection attempt {attempt} failed: {e}")
                if attempt < self.max_retries:
                    wait_time = min(2**attempt, 30)
                    logger.info(f"Retrying in {wait_time} seconds...")
                    await asyncio.sleep(wait_time)
                else:
                    logger.critical("Failed to connect to database after all retries")
                    raise

    async def close(self):
        """Close database connection pool."""
        if self.pool:
            await self.pool.close()
            logger.info("Database connection pool closed")

    async def healthcheck(self) -> bool:
        """Check database connection health."""
        try:
            async with self.pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            return True
        except Exception as e:
            logger.error(f"Database healthcheck failed: {e}")
            return False
