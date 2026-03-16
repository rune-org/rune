import secrets
from typing import Annotated
from fastapi import Header
from src.core.config import get_settings
from src.core.exceptions import InternalAPIKeyError, Unauthorized


async def verify_internal_key(
    x_internal_key: Annotated[str | None, Header()] = None,
) -> None:
    """Verify the X-Internal-Key header against the configured internal API key."""
    settings = get_settings()
    if not settings.internal_api_key:
        raise InternalAPIKeyError()
    if x_internal_key is None or not secrets.compare_digest(
        x_internal_key, settings.internal_api_key
    ):
        raise Unauthorized("Invalid internal API key")
