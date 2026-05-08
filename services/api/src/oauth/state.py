from datetime import datetime, timedelta, timezone

import jwt

from src.core.config import get_settings
from src.core.exceptions import BadRequest

OAUTH_STATE_TYP = "oauth_connect"
STATE_TTL_MINUTES = 10


def encode_oauth_state(credential_id: int, user_id: int) -> str:
    settings = get_settings()
    if not settings.jwt_secret_key:
        raise ValueError("JWT_SECRET_KEY is not configured")

    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=STATE_TTL_MINUTES)
    payload = {
        "typ": OAUTH_STATE_TYP,
        "cid": credential_id,
        "uid": user_id,
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_oauth_state(token: str) -> tuple[int, int]:
    """Return (credential_id, user_id) from a signed state token."""
    settings = get_settings()
    if not settings.jwt_secret_key:
        raise ValueError("JWT_SECRET_KEY is not configured")

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.ExpiredSignatureError:
        raise BadRequest(detail="OAuth state expired. Start Connect again.") from None
    except jwt.InvalidTokenError as e:
        raise BadRequest(detail="Invalid OAuth state") from e

    if payload.get("typ") != OAUTH_STATE_TYP:
        raise BadRequest(detail="Invalid OAuth state type")

    try:
        credential_id = int(payload["cid"])
        user_id = int(payload["uid"])
    except (KeyError, TypeError, ValueError) as e:
        raise BadRequest(detail="Malformed OAuth state") from e

    return credential_id, user_id
