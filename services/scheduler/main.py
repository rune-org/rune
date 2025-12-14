"""
Standalone Workflow Scheduler Service

Minimal, efficient scheduler that polls database for scheduled workflows
and publishes them to RabbitMQ for execution by worker services.
"""

import asyncio
import logging
import signal
import sys
import traceback
from datetime import datetime, timedelta

from config import Config
from logger import setup_logging
from database import DatabasePool
from rabbitmq_client import MessageQueue
from executor import ScheduleExecutor


logger = setup_logging(Config.LOG_LEVEL)


class WorkflowScheduler:
    """Main scheduler service coordinating all components."""
    
    def __init__(self):
        """Initialize scheduler service."""
        self.db_pool = DatabasePool(Config.database_dsn())
        self.message_queue = MessageQueue(
            Config.rabbitmq_url(), 
            Config.RABBITMQ_QUEUE
        )
        self.executor = ScheduleExecutor(self.message_queue)
        self.running = False
        self.stats = {
            "total_checks": 0,
            "last_check": None
        }
    
    async def start(self):
        """Start the scheduler service."""
        self._log_startup()
        
        # Setup signal handlers for graceful shutdown
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(
                sig, 
                lambda: asyncio.create_task(self.stop())
            )
        
        try:
            # Initialize connections
            await self.db_pool.connect()
            await self.message_queue.connect()
            
            self.running = True
            logger.info("Scheduler service started successfully")
            
            # Start background tasks
            await asyncio.gather(
                self._polling_loop(),
                self._healthcheck_loop(),
                return_exceptions=True
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
        
        # Log final statistics
        logger.info(f"Final Statistics:")
        logger.info(f"  - Total Checks: {self.stats['total_checks']}")
        logger.info(f"  - Total Executions: {self.executor.stats['total_executions']}")
        logger.info(f"  - Total Failures: {self.executor.stats['total_failures']}")
        
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
                self.stats["last_check"] = datetime.now()
                
            except Exception as e:
                logger.error(f"Error in polling loop: {e}")
                logger.error(traceback.format_exc())
            
            await asyncio.sleep(Config.POLL_INTERVAL)
    
    async def _healthcheck_loop(self):
        """Periodic healthcheck to monitor service health."""
        await asyncio.sleep(Config.HEALTHCHECK_INTERVAL)
        
        while self.running:
            try:
                db_healthy = await self.db_pool.healthcheck()
                mq_healthy = await self.message_queue.healthcheck()
                
                if db_healthy and mq_healthy:
                    logger.info(
                        f"HEALTHCHECK OK | "
                        f"Checks: {self.stats['total_checks']} | "
                        f"Executions: {self.executor.stats['total_executions']} | "
                        f"Failures: {self.executor.stats['total_failures']}"
                    )
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
        self.stats["total_checks"] += 1
        
        now = datetime.now()
        look_ahead_time = now + timedelta(seconds=Config.LOOK_AHEAD_SECONDS)
        
        # Direct SQL query for maximum efficiency
        query = """
            SELECT 
                sw.id as schedule_id,
                sw.workflow_id,
                sw.next_run_at,
                sw.interval_seconds,
                sw.run_count,
                sw.failure_count,
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
                tasks = [
                    self.executor.execute_schedule(row, self.db_pool)
                    for row in rows
                ]
                
                await asyncio.gather(*tasks, return_exceptions=True)
                
        except Exception as e:
            logger.error(f"Failed to check schedules: {e}")
            logger.error(traceback.format_exc())
    
    def _log_startup(self):
        """Log startup information."""
        logger.info("=" * 80)
        logger.info("RUNE WORKFLOW SCHEDULER STARTING")
        logger.info("=" * 80)
        logger.info(f"Configuration:")
        logger.info(f"  - Poll Interval: {Config.POLL_INTERVAL}s")
        logger.info(f"  - Look Ahead: {Config.LOOK_AHEAD_SECONDS}s")
        logger.info(f"  - Database: {Config.POSTGRES_HOST}:{Config.POSTGRES_PORT}/{Config.POSTGRES_DB}")
        logger.info(f"  - RabbitMQ: {Config.RABBITMQ_HOST}:{Config.RABBITMQ_PORT}/{Config.RABBITMQ_QUEUE}")
        logger.info("=" * 80)


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
