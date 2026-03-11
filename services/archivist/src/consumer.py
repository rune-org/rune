import logging

import aio_pika
from aio_pika import ExchangeType, IncomingMessage
from sqlalchemy.ext.asyncio import AsyncEngine

from src.config import Settings
from src.models import CompletionMessage
from src.repository import update_execution

logger = logging.getLogger(__name__)


async def handle_message(message: IncomingMessage, engine: AsyncEngine) -> None:
    try:
        data = CompletionMessage.model_validate_json(message.body)
    except Exception:
        logger.exception("Failed to deserialize completion message, dropping")
        await message.nack(requeue=False)
        return

    try:
        found = await update_execution(engine, data)

        if not found:
            logger.warning(
                "Execution %s not found, requeueing message", data.execution_id
            )
            await message.nack(requeue=True)
            return

        await message.ack()
        logger.info("Recorded completion for execution %s", data.execution_id)

    except Exception:
        logger.exception("DB error processing execution %s", data.execution_id)
        await message.nack(requeue=True)


async def start_consumer(
    rabbitmq_url: str, engine: AsyncEngine, settings: Settings
) -> aio_pika.Connection:
    connection = await aio_pika.connect_robust(rabbitmq_url)
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=settings.rabbitmq_prefetch)

    exchange = await channel.declare_exchange(
        settings.rabbitmq_exchange, ExchangeType.TOPIC, durable=True
    )

    queue = await channel.declare_queue(settings.rabbitmq_queue, durable=True)
    await queue.bind(exchange, routing_key=settings.rabbitmq_routing_key)

    await queue.consume(lambda msg: handle_message(msg, engine))

    logger.info(
        "Consuming from queue '%s' bound to exchange '%s' with key '%s'",
        settings.rabbitmq_queue,
        settings.rabbitmq_exchange,
        settings.rabbitmq_routing_key,
    )

    return connection
