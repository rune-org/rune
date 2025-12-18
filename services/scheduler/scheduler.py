#!/usr/bin/env python3
"""
Standalone Workflow Scheduler Service

A minimal, efficient scheduler that:
- Polls database for scheduled workflows using direct SQL queries
- Publishes workflow execution messages to RabbitMQ
- Handles many concurrent workflows with minimal resource usage
- Provides comprehensive logging with fallback mechanisms
- Runs independently from the main API service
"""

import asyncio
import json
import logging
import os
import signal
import sys
import traceback
from datetime import datetime, timedelta
from typing import Any, Optional

import asyncpg
import aio_pika
from aio_pika import Message, DeliveryMode
from aio_pika.abc import AbstractRobustConnection


# ============================================================================
# CONFIGURATION
# ============================================================================


class Config:
    """Configuration loaded from environment variables."""

    # Database Configuration
    POSTGRES_HOST = os.getenv("POSTGRES_HOST", "db")
    POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_DB = os.getenv("POSTGRES_DB", "rune")
    POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")

    # RabbitMQ Configuration
    RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
    RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", "5672"))
    RABBITMQ_USER = os.getenv("RABBITMQ_USER", "guest")
    RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "guest")
    RABBITMQ_QUEUE = os.getenv("RABBITMQ_QUEUE", "workflow_queue")

    # Scheduler Configuration
    POLL_INTERVAL = int(os.getenv("SCHEDULER_POLL_INTERVAL", "30"))
    LOOK_AHEAD_SECONDS = int(os.getenv("SCHEDULER_LOOK_AHEAD", "60"))
    MAX_CONCURRENT_EXECUTIONS = int(os.getenv("SCHEDULER_MAX_CONCURRENT", "100"))
    HEALTHCHECK_INTERVAL = int(os.getenv("SCHEDULER_HEALTHCHECK_INTERVAL", "300"))

    # Logging Configuration
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

    @classmethod
    def database_dsn(cls) -> str:
        """Build PostgreSQL DSN."""
        return (
            f"postgresql://{cls.POSTGRES_USER}:{cls.POSTGRES_PASSWORD}@"
            f"{cls.POSTGRES_HOST}:{cls.POSTGRES_PORT}/{cls.POSTGRES_DB}"
        )

    @classmethod
    def rabbitmq_url(cls) -> str:
        """Build RabbitMQ connection URL."""
        return (
            f"amqp://{cls.RABBITMQ_USER}:{cls.RABBITMQ_PASSWORD}@"
            f"{cls.RABBITMQ_HOST}:{cls.RABBITMQ_PORT}/"
        )


# ============================================================================
# LOGGING SETUP
# ============================================================================


def setup_logging() -> logging.Logger:
    """
    Configure comprehensive logging with fallback mechanisms.

    Logs go to:
    - stdout (for Docker logs)
    - stderr (for critical errors)
    """
    # Root logger configuration
    log_format = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"

    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, Config.LOG_LEVEL.upper(), logging.INFO),
        format=log_format,
        datefmt=date_format,
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
        force=True,
    )

    # Create scheduler logger
    logger = logging.getLogger("scheduler")

    # Add error handler to stderr for critical issues
    error_handler = logging.StreamHandler(sys.stderr)
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(logging.Formatter(log_format, datefmt=date_format))
    logger.addHandler(error_handler)

    return logger


logger = setup_logging()


# ============================================================================
# DATABASE CONNECTION POOL
# ============================================================================


class DatabasePool:
    """Manages PostgreSQL connection pool with automatic reconnection."""

    def __init__(self, dsn: str, max_retries: int = 5):
        self.dsn = dsn
        self.max_retries = max_retries
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self) -> asyncpg.Pool:
        """Establish database connection with retry logic."""
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info(
                    f"Connecting to database (attempt {attempt}/{self.max_retries})..."
                )
                self.pool = await asyncpg.create_pool(
                    self.dsn,
                    min_size=2,
                    max_size=10,
                    command_timeout=60,
                    server_settings={"application_name": "rune-scheduler"},
                )
                logger.info("Database connection pool established")
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


# ============================================================================
# RABBITMQ CONNECTION
# ============================================================================


class MessageQueue:
    """Manages RabbitMQ connection with automatic reconnection."""

    def __init__(self, url: str, queue_name: str, max_retries: int = 5):
        self.url = url
        self.queue_name = queue_name
        self.max_retries = max_retries
        self.connection: Optional[AbstractRobustConnection] = None
        self.channel = None
        self.queue = None

    async def connect(self):
        """Establish RabbitMQ connection with retry logic."""
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info(
                    f"Connecting to RabbitMQ (attempt {attempt}/{self.max_retries})..."
                )
                self.connection = await aio_pika.connect_robust(
                    self.url,
                    timeout=30,
                )
                self.channel = await self.connection.channel()
                await self.channel.set_qos(
                    prefetch_count=Config.MAX_CONCURRENT_EXECUTIONS
                )

                # Declare queue (idempotent - safe if already exists)
                self.queue = await self.channel.declare_queue(
                    self.queue_name, durable=True, auto_delete=False
                )

                logger.info(
                    f"RabbitMQ connection established (queue: {self.queue_name})"
                )
                return
            except Exception as e:
                logger.error(f"RabbitMQ connection attempt {attempt} failed: {e}")
                if attempt < self.max_retries:
                    wait_time = min(2**attempt, 30)
                    logger.info(f"Retrying in {wait_time} seconds...")
                    await asyncio.sleep(wait_time)
                else:
                    logger.critical("Failed to connect to RabbitMQ after all retries")
                    raise

    async def publish_workflow(
        self, workflow_id: int, schedule_id: int, workflow_data: dict[str, Any]
    ) -> bool:
        """
        Publish workflow execution message to RabbitMQ.

        Returns:
            True if successful, False otherwise
        """
        try:
            message_body = {
                "workflow_id": workflow_id,
                "schedule_id": schedule_id,
                "workflow_data": workflow_data,
                "triggered_at": datetime.now().isoformat(),
                "trigger_source": "scheduler",
            }

            message = Message(
                body=json.dumps(message_body).encode(),
                delivery_mode=DeliveryMode.PERSISTENT,
                content_type="application/json",
                timestamp=datetime.now(),
            )

            await self.channel.default_exchange.publish(
                message, routing_key=self.queue_name
            )

            logger.info(
                f"Published workflow execution: workflow_id={workflow_id}, schedule_id={schedule_id}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to publish workflow {workflow_id}: {e}")
            return False

    async def close(self):
        """Close RabbitMQ connection."""
        if self.connection and not self.connection.is_closed:
            await self.connection.close()
            logger.info("RabbitMQ connection closed")

    async def healthcheck(self) -> bool:
        """Check RabbitMQ connection health."""
        try:
            return self.connection and not self.connection.is_closed
        except Exception:
            return False


# ============================================================================
# SCHEDULER SERVICE
# ============================================================================


class WorkflowScheduler:
    """
    Standalone workflow scheduler service.

    Efficiently handles multiple scheduled workflows with:
    - Direct SQL queries for minimal overhead
    - Concurrent execution support
    - Comprehensive error handling and logging
    - Automatic recovery from failures
    """

    def __init__(self):
        self.db_pool = DatabasePool(Config.database_dsn())
        self.message_queue = MessageQueue(Config.rabbitmq_url(), Config.RABBITMQ_QUEUE)
        self.running = False

    async def start(self):
        """Start the scheduler service."""
        logger.info("=" * 80)
        logger.info("RUNE WORKFLOW SCHEDULER STARTING")
        logger.info("=" * 80)
        logger.info("Configuration:")
        logger.info(f"  - Poll Interval: {Config.POLL_INTERVAL}s")
        logger.info(f"  - Look Ahead: {Config.LOOK_AHEAD_SECONDS}s")
        logger.info(f"  - Max Concurrent: {Config.MAX_CONCURRENT_EXECUTIONS}")
        logger.info(
            f"  - Database: {Config.POSTGRES_HOST}:{Config.POSTGRES_PORT}/{Config.POSTGRES_DB}"
        )
        logger.info(
            f"  - RabbitMQ: {Config.RABBITMQ_HOST}:{Config.RABBITMQ_PORT}/{Config.RABBITMQ_QUEUE}"
        )
        logger.info("=" * 80)

        # Setup signal handlers for graceful shutdown
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, lambda: asyncio.create_task(self.stop()))

        try:
            # Initialize connections
            await self.db_pool.connect()
            await self.message_queue.connect()

            self.running = True
            logger.info("Scheduler service started successfully")

            # Start background tasks
            await asyncio.gather(
                self._polling_loop(), self._healthcheck_loop(), return_exceptions=True
            )

        except Exception as e:
            logger.critical(f"Failed to start scheduler service: {e}")
            logger.critical(traceback.format_exc())
            await self.stop()
            sys.exit(1)

    async def stop(self):
        """Stop the scheduler service gracefully."""
        if not self.running:
            return

        logger.info("=" * 80)
        logger.info("SCHEDULER SHUTTING DOWN")
        logger.info("=" * 80)

        self.running = False

        # Close connections
        await self.message_queue.close()
        await self.db_pool.close()

        logger.info("Scheduler stopped gracefully")
        logger.info("=" * 80)

    async def _polling_loop(self):
        """Main polling loop that checks for scheduled workflows."""
        logger.info("Polling loop started")

        while self.running:
            try:
                await self._check_and_execute_schedules()

            except Exception as e:
                logger.error(f"Error in polling loop: {e}")
                logger.error(traceback.format_exc())
                # Continue running despite errors

            await asyncio.sleep(Config.POLL_INTERVAL)

    async def _healthcheck_loop(self):
        """Periodic healthcheck to monitor service health."""
        await asyncio.sleep(Config.HEALTHCHECK_INTERVAL)

        while self.running:
            try:
                db_healthy = await self.db_pool.healthcheck()
                mq_healthy = await self.message_queue.healthcheck()

                if db_healthy and mq_healthy:
                    logger.info("HEALTHCHECK OK")
                else:
                    logger.error(
                        f"HEALTHCHECK FAILED | "
                        f"DB: {'OK' if db_healthy else 'FAIL'} | "
                        f"MQ: {'OK' if mq_healthy else 'FAIL'}"
                    )

            except Exception as e:
                logger.error(f"Healthcheck error: {e}")

            await asyncio.sleep(Config.HEALTHCHECK_INTERVAL)

    async def _check_and_execute_schedules(self):
        """Check for due schedules and execute them."""
        now = datetime.now()
        look_ahead_time = now + timedelta(seconds=Config.LOOK_AHEAD_SECONDS)

        # Direct SQL query for maximum efficiency
        query = """
            SELECT 
                sw.id as schedule_id,
                sw.workflow_id,
                sw.next_run_at,
                sw.interval_seconds,
                w.workflow_data,
                w.name as workflow_name
            FROM scheduled_workflows sw
            INNER JOIN workflows w ON sw.workflow_id = w.id
            WHERE 
                sw.is_active = true
                AND sw.next_run_at <= $1
            ORDER BY sw.next_run_at ASC
        """

        try:
            async with self.db_pool.pool.acquire() as conn:
                rows = await conn.fetch(query, look_ahead_time)

                if not rows:
                    logger.debug(
                        f"No schedules due (checked up to {look_ahead_time.isoformat()})"
                    )
                    return

                logger.info(f"Found {len(rows)} schedule(s) due for execution")

                # Execute schedules concurrently
                tasks = [self._execute_schedule(row, conn) for row in rows]

                await asyncio.gather(*tasks, return_exceptions=True)

        except Exception as e:
            logger.error(f"Failed to check schedules: {e}")
            logger.error(traceback.format_exc())

    async def _execute_schedule(self, row: asyncpg.Record, conn: asyncpg.Connection):
        """Execute a single scheduled workflow."""
        schedule_id = row["schedule_id"]
        workflow_id = row["workflow_id"]
        workflow_name = row["workflow_name"]
        next_run_at = row["next_run_at"]
        interval_seconds = row["interval_seconds"]

        try:
            # Check if workflow is actually due (account for look-ahead)
            now = datetime.now()
            if next_run_at > now:
                seconds_until = (next_run_at - now).total_seconds()
                logger.debug(
                    f"Schedule {schedule_id} not yet due "
                    f"(workflow: {workflow_name}, in {seconds_until:.1f}s)"
                )
                return

            logger.info(
                f"Executing schedule {schedule_id} | "
                f"Workflow: {workflow_name} (ID: {workflow_id})"
            )

            # Publish workflow to RabbitMQ
            success = await self.message_queue.publish_workflow(
                workflow_id=workflow_id,
                schedule_id=schedule_id,
                workflow_data=row["workflow_data"],
            )

            if success:
                # Update schedule with success
                await self._update_schedule_after_execution(
                    conn, schedule_id, interval_seconds, success=True
                )

                logger.info(
                    f"Successfully executed schedule {schedule_id} "
                    f"(workflow: {workflow_name})"
                )
            else:
                # Update schedule with failure
                await self._update_schedule_after_execution(
                    conn,
                    schedule_id,
                    interval_seconds,
                    success=False,
                    error_message="Failed to publish to RabbitMQ",
                )

                logger.error(
                    f"Failed to execute schedule {schedule_id} "
                    f"(workflow: {workflow_name}): RabbitMQ publish failed"
                )

        except Exception as e:
            logger.error(
                f"Error executing schedule {schedule_id} "
                f"(workflow: {workflow_name}): {e}"
            )
            logger.error(traceback.format_exc())

            # Still update schedule to prevent it from getting stuck
            try:
                await self._update_schedule_after_execution(
                    conn,
                    schedule_id,
                    interval_seconds,
                    success=False,
                    error_message=str(e),
                )
            except Exception as update_error:
                logger.critical(
                    f"CRITICAL: Failed to update schedule {schedule_id} after error: {update_error}"
                )

    async def _update_schedule_after_execution(
        self,
        conn: asyncpg.Connection,
        schedule_id: int,
        interval_seconds: int,
        success: bool,
        error_message: Optional[str] = None,
    ):
        """
        Update schedule metadata after execution.

        CRITICAL: This must always succeed to prevent stuck schedules.
        """
        now = datetime.now()
        next_run_at = now + timedelta(seconds=interval_seconds)

        if success:
            update_query = """
                UPDATE scheduled_workflows
                SET
                    last_run_at = $1,
                    next_run_at = $2,
                    updated_at = $1
                WHERE id = $3
            """
            await conn.execute(update_query, now, next_run_at, schedule_id)
        else:
            update_query = """
                UPDATE scheduled_workflows
                SET
                    last_run_at = $1,
                    next_run_at = $2,
                    updated_at = $1
                WHERE id = $3
            """
            await conn.execute(update_query, now, next_run_at, schedule_id)

        logger.debug(
            f"Updated schedule {schedule_id}: next_run_at={next_run_at.isoformat()}, "
            f"success={success}"
        )


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================


async def main():
    """Main entry point for the scheduler service."""
    scheduler = WorkflowScheduler()
    try:
        await scheduler.start()
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt")
        await scheduler.stop()
    except Exception as e:
        logger.critical(f"Unhandled exception in main: {e}")
        logger.critical(traceback.format_exc())
        await scheduler.stop()
        sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        logger.critical(f"Failed to run scheduler: {e}")
        sys.exit(1)
