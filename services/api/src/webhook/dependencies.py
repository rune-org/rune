from fastapi import Depends

from src.core.config import get_settings
from src.core.dependencies import DatabaseDep
from src.queue.rabbitmq import get_rabbitmq
from src.webhook.service import WebhookService
from src.workflow.queue import WorkflowQueueService


def get_queue_service(connection=Depends(get_rabbitmq)) -> WorkflowQueueService:
    return WorkflowQueueService(
        connection=connection, queue_name=get_settings().rabbitmq_workflow_queue
    )


def get_webhook_service(
    db: DatabaseDep,
    queue_service: WorkflowQueueService = Depends(get_queue_service),
) -> WebhookService:
    return WebhookService(db=db, queue_service=queue_service)
