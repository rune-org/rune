"""Background scheduler daemon for executing scheduled workflows."""

import asyncio
import logging
import os
import uuid
from datetime import datetime
from typing import Any

from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from src.core.config import get_settings
from src.scheduler.service import ScheduledWorkflowService
from src.queue.service import WorkflowQueueService
from src.queue.rabbitmq import get_rabbitmq_connection
from src.workflow.service import WorkflowService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class SchedulerDaemon:
    """
    Background daemon that polls for scheduled workflows and triggers them.

    This service runs independently and:
    1. Polls the database for schedules due for execution
    2. Publishes workflow run messages to RabbitMQ
    3. Updates schedule metadata after execution attempts
    """

    def __init__(
        self,
        poll_interval: int = 30,
        look_ahead_seconds: int = 60,
    ):
        """
        Initialize the scheduler daemon.

        Args:
            poll_interval: How often to check for due schedules (seconds)
            look_ahead_seconds: How far ahead to look for due schedules (seconds)
        """
        self.poll_interval = poll_interval
        self.look_ahead_seconds = look_ahead_seconds
        self.running = False
        self.settings = get_settings()

        # Database setup
        self.engine = create_async_engine(
            self.settings.database_url or self._build_database_url(),
            echo=False,
        )
        self.async_session = async_sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

        # RabbitMQ connection (will be initialized in start())
        self.rabbitmq_connection = None
        self.queue_service = None

        logger.info(
            f"Scheduler daemon initialized (poll_interval={poll_interval}s, look_ahead={look_ahead_seconds}s)"
        )

    def _build_database_url(self) -> str:
        """Build database URL from settings."""
        return (
            f"postgresql+asyncpg://{self.settings.postgres_user}:"
            f"{self.settings.postgres_password}@{self.settings.postgres_host}:"
            f"{self.settings.postgres_port}/{self.settings.postgres_db}"
        )

    async def start(self) -> None:
        """Start the scheduler daemon."""
        logger.info("Starting scheduler daemon...")
        self.running = True

        # Initialize RabbitMQ connection (Docker healthcheck ensures it's ready)
        try:
            self.rabbitmq_connection = await get_rabbitmq_connection()
            self.queue_service = WorkflowQueueService(
                connection=self.rabbitmq_connection,
                queue_name=self.settings.rabbitmq_queue_name,
            )
            logger.info("RabbitMQ connection established")
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            self.running = False
            raise

        # Start the polling loop
        try:
            await self._polling_loop()
        except Exception as e:
            logger.error(f"Scheduler daemon error: {e}")
        finally:
            await self.stop()

    async def stop(self) -> None:
        """Stop the scheduler daemon."""
        logger.info("Stopping scheduler daemon...")
        self.running = False

        # Close RabbitMQ connection
        if self.rabbitmq_connection and not self.rabbitmq_connection.is_closed:
            await self.rabbitmq_connection.close()
            logger.info("RabbitMQ connection closed")

        # Close database engine
        await self.engine.dispose()
        logger.info("Database connection closed")

    async def _polling_loop(self) -> None:
        """Main polling loop that checks for due schedules."""
        logger.info("Scheduler polling loop started")

        while self.running:
            try:
                await self._check_and_execute_schedules()
            except Exception as e:
                logger.error(f"Error in polling loop: {e}", exc_info=True)

            # Wait for next poll interval
            await asyncio.sleep(self.poll_interval)

    async def _check_and_execute_schedules(self) -> None:
        """Check for schedules due for execution and trigger them."""
        async with self.async_session() as session:
            scheduler_service = ScheduledWorkflowService(db=session)
            workflow_service = WorkflowService(db=session)

            now = datetime.now()
            logger.debug(f"Polling at {now.isoformat()} (look_ahead={self.look_ahead_seconds}s)")

            # Get schedules due for execution
            due_schedules = await scheduler_service.get_schedules_due_for_execution(
                look_ahead_seconds=self.look_ahead_seconds
            )

            if not due_schedules:
                logger.debug("No schedules due for execution")
                return

            logger.info(f"Found {len(due_schedules)} schedule(s) due for execution")

            for schedule in due_schedules:
                time_until_run = (schedule.next_run_at - now).total_seconds()
                logger.info(
                    f"Schedule {schedule.id} (workflow_id={schedule.workflow_id}): "
                    f"next_run_at={schedule.next_run_at.isoformat()}, "
                    f"time_until_run={time_until_run:.1f}s, "
                    f"is_active={schedule.is_active}, "
                    f"run_count={schedule.run_count}"
                )

                # Only execute if next_run_at is now or in the past
                if schedule.next_run_at > now:
                    logger.debug(f"Schedule {schedule.id} not yet due (in {time_until_run:.1f}s), skipping")
                    continue

                try:
                    await self._execute_scheduled_workflow(
                        schedule, workflow_service, scheduler_service
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to execute schedule {schedule.id} for workflow {schedule.workflow_id}: {e}",
                        exc_info=True,
                    )
                    # CRITICAL: Always update next_run even on failure to prevent stuck schedules
                    await scheduler_service.update_schedule_after_execution(
                        schedule, success=False, error_message=str(e)
                    )

    async def _execute_scheduled_workflow(
        self,
        schedule: Any,
        workflow_service: WorkflowService,
        scheduler_service: ScheduledWorkflowService,
    ) -> None:
        """
        Execute a scheduled workflow.

        Args:
            schedule: The ScheduledWorkflow instance
            workflow_service: Service for workflow operations
            scheduler_service: Service for schedule operations
        """
        workflow = await workflow_service.get_by_id(schedule.workflow_id)
        if not workflow:
            logger.error(
                f"Workflow {schedule.workflow_id} not found, skipping execution"
            )
            await scheduler_service.update_schedule_after_execution(
                schedule, success=False, error_message="Workflow not found"
            )
            return

        try:
            # Resolve credentials in the workflow
            resolved_workflow_data = (
                await workflow_service.resolve_workflow_credentials(
                    workflow.workflow_data
                )
            )

            # Generate unique execution ID
            execution_id = f"scheduled_{uuid.uuid4().hex[:16]}"

            # Publish to RabbitMQ
            queue_start = datetime.now()
            await self.queue_service.publish_workflow_run(
                workflow_id=workflow.id,
                execution_id=execution_id,
                workflow_data=resolved_workflow_data,
            )
            queue_duration = (datetime.now() - queue_start).total_seconds()

            logger.info(
                f"✓ Successfully queued workflow {workflow.id} (name='{workflow.name}', "
                f"schedule_id={schedule.id}, execution_id={execution_id}, "
                f"queue_time={queue_duration:.3f}s, interval={schedule.interval_seconds}s)"
            )

            # Update schedule with success
            await scheduler_service.update_schedule_after_execution(
                schedule, success=True
            )
            
            logger.info(
                f"Updated schedule {schedule.id}: next_run_at={schedule.next_run_at.isoformat()}, "
                f"run_count={schedule.run_count}"
            )

        except Exception as e:
            logger.error(
                f"Failed to queue scheduled workflow {workflow.id}: {e}", exc_info=True
            )
            await scheduler_service.update_schedule_after_execution(
                schedule, success=False, error_message=str(e)
            )


async def main():
    """Main entry point for the scheduler daemon."""
    # Read configuration directly from environment variables
    poll_interval = int(os.getenv("SCHEDULER_POLL_INTERVAL", "30"))
    look_ahead = int(os.getenv("SCHEDULER_LOOK_AHEAD_SECONDS", "60"))

    logger.info(
        f"Starting with poll_interval={poll_interval}s, look_ahead={look_ahead}s"
    )

    daemon = SchedulerDaemon(
        poll_interval=poll_interval,
        look_ahead_seconds=look_ahead,
    )

    try:
        await daemon.start()
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
        await daemon.stop()


if __name__ == "__main__":
    asyncio.run(main())
