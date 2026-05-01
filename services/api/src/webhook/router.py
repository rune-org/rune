from fastapi import APIRouter, Depends, Request, Response

from src.webhook.dependencies import get_webhook_service
from src.webhook.service import WebhookService

router = APIRouter(prefix="/webhook", tags=["Webhook"])


@router.post("/{guid}", status_code=202)
async def trigger_webhook(
    guid: str,
    request: Request,
    service: WebhookService = Depends(get_webhook_service),
) -> Response:
    """Trigger a workflow via its registered webhook URL.

    The request body (JSON) is forwarded to the worker as trigger data
    under the ``$trigger`` key in the execution context.

    No authentication is required — the GUID itself is the secret.
    Returns 404 if the GUID is unknown or the workflow is inactive.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    await service.trigger(guid, body)
    return Response(status_code=202)
