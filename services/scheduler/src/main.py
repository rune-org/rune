import asyncio
import signal

import asyncpg

from src.client import ApiClient
from src.config import POLL_INTERVAL, POSTGRES_DSN, log
from src.db import poll


async def main() -> None:
    log.info("Starting scheduler (poll=%ds)", POLL_INTERVAL)

    conn = await asyncpg.connect(POSTGRES_DSN)
    api_client = ApiClient()
    await api_client.start()

    log.info("Connected to PostgreSQL and API client initialized")

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)

    while not stop.is_set():
        try:
            await poll(conn, api_client)
        except Exception:
            log.exception("Poll error")

        try:
            await asyncio.wait_for(stop.wait(), timeout=POLL_INTERVAL)
        except asyncio.TimeoutError:
            pass  # normal — just means the sleep finished

    log.info("Shutting down")
    await api_client.close()
    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
