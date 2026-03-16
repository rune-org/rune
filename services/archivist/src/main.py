import asyncio
import logging
import signal

from sqlalchemy.ext.asyncio import create_async_engine

from src.config import Settings
from src.consumer import start_consumer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def main() -> None:
    settings = Settings()
    engine = create_async_engine(settings.db_url)

    connection = await start_consumer(settings.amqp_url, engine, settings)

    logger.info("Completion recorder running")

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop_event.set)
        except NotImplementedError:
            # Windows fallback
            signal.signal(sig, lambda *_: loop.call_soon_threadsafe(stop_event.set))

    await stop_event.wait()

    logger.info("Shutting down...")
    await connection.close()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
