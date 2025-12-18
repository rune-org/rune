"""Schedule execution logic."""

import json
import logging
import traceback
from datetime import datetime, timedelta
from typing import Optional
from cryptography.fernet import Fernet

import asyncpg

from config import Config
from credentials import CredentialResolver


logger = logging.getLogger("scheduler.executor")


class ScheduleExecutor:
    """Handles execution of scheduled workflows."""

    def __init__(self, message_queue):
        """
        Initialize schedule executor.

        Args:
            message_queue: MessageQueue instance for publishing workflows
        """
        self.message_queue = message_queue
        self.stats = {
            "total_executions": 0,
            "total_failures": 0,
            "last_execution": None,
        }

        # Initialize credential resolver with encryption key from config
        encryption_key = Config.ENCRYPTION_KEY.encode()
        self.encryptor = Fernet(encryption_key)
        self.credential_resolver = CredentialResolver(self.encryptor)

    async def execute_schedule(self, row: asyncpg.Record, db_pool):
        """
        Execute a single scheduled workflow.

        Args:
            row: Database row with schedule and workflow data
            db_pool: DatabasePool instance to acquire connections from
        """
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

            # Parse workflow_data if it's a string
            workflow_data = row["workflow_data"]
            if isinstance(workflow_data, str):
                workflow_data = json.loads(workflow_data)

            # === RESOLVE CREDENTIALS (cloned from API) ===
            # This is critical - without this, worker will fail with "host is required"
            async with db_pool.pool.acquire() as conn:
                try:
                    workflow_data = (
                        await self.credential_resolver.resolve_workflow_credentials(
                            workflow_data, conn
                        )
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to resolve credentials for schedule {schedule_id}: {e}"
                    )
                    logger.error(traceback.format_exc())
                    await self._update_schedule_after_execution(
                        conn,
                        schedule_id,
                        interval_seconds,
                        success=False,
                        error_message=f"Credential resolution failed: {e}",
                    )
                    self.stats["total_failures"] += 1
                    return

            # Publish workflow to RabbitMQ with resolved credentials
            success = await self.message_queue.publish_workflow(
                workflow_id=workflow_id,
                schedule_id=schedule_id,
                workflow_data=workflow_data,  # Use the RESOLVED workflow_data, not row["workflow_data"]
            )

            if success:
                async with db_pool.pool.acquire() as conn:
                    await self._update_schedule_after_execution(
                        conn, schedule_id, interval_seconds, success=True
                    )
                self.stats["total_executions"] += 1
                self.stats["last_execution"] = datetime.now()

                logger.info(
                    f"Successfully executed schedule {schedule_id} "
                    f"(workflow: {workflow_name})"
                )
            else:
                async with db_pool.pool.acquire() as conn:
                    await self._update_schedule_after_execution(
                        conn,
                        schedule_id,
                        interval_seconds,
                        success=False,
                        error_message="Failed to publish to RabbitMQ",
                    )
                self.stats["total_failures"] += 1

                logger.error(
                    f"Failed to execute schedule {schedule_id} "
                    f"(workflow: {workflow_name}): RabbitMQ publish failed"
                )

        except Exception as e:
            self.stats["total_failures"] += 1
            logger.error(
                f"Error executing schedule {schedule_id} "
                f"(workflow: {workflow_name}): {e}"
            )
            logger.error(traceback.format_exc())

            # Still update schedule to prevent it from getting stuck
            try:
                async with db_pool.pool.acquire() as conn:
                    await self._update_schedule_after_execution(
                        conn,
                        schedule_id,
                        interval_seconds,
                        success=False,
                        error_message=str(e),
                    )
            except Exception as update_error:
                logger.critical(
                    f"CRITICAL: Failed to update schedule {schedule_id} "
                    f"after error: {update_error}"
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

        Args:
            conn: Database connection
            schedule_id: Schedule ID to update
            interval_seconds: Interval for next execution
            success: Whether execution was successful
            error_message: Error message if failed
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
