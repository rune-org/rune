from datetime import datetime, timezone
from typing import Any

from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.config import get_settings
from src.core.exceptions import BadRequest
from src.credentials.encryption import CredentialEncryption
from src.db.models import CredentialType, WorkflowCredential
from src.oauth.credential_tokens import (
    clear_oauth_session_tokens,
    is_invalid_grant_response,
    merge_refresh_tokens,
)
from src.oauth.token_exchange import (
    OAuthTokenHttpError,
    parse_token_error_json_payload,
    post_oauth_token_form,
)


def _parse_expires_at(raw: Any) -> datetime | None:
    if raw is None or raw == "":
        return None
    if isinstance(raw, datetime):
        if raw.tzinfo is None:
            return raw.replace(tzinfo=timezone.utc)
        return raw
    if isinstance(raw, str):
        s = raw.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(s)
        except ValueError:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    return None


async def ensure_oauth2_access_token(
    db: AsyncSession,
    credential: WorkflowCredential,
    encryptor: CredentialEncryption,
) -> dict[str, Any]:
    """
    Return decrypted credential_data, refreshing the access token when near expiry.

    Persists updates to `credential` when refresh runs or tokens are cleared.
    """
    if credential.credential_type != CredentialType.OAUTH2:
        return encryptor.decrypt_credential_data(credential.credential_data)

    settings = get_settings()
    skew = max(0, int(settings.oauth_refresh_skew_seconds))

    data = encryptor.decrypt_credential_data(credential.credential_data)
    access_token = data.get("access_token")
    refresh_token = data.get("refresh_token")

    if not access_token and not refresh_token:
        raise BadRequest(
            detail="This OAuth2 credential is not connected. Use Connect in Credentials."
        )

    expires_at = _parse_expires_at(data.get("expires_at"))
    now = datetime.now(timezone.utc)

    needs_refresh = False
    if not access_token and refresh_token:
        needs_refresh = True
    elif expires_at is None:
        if refresh_token:
            needs_refresh = True
    else:
        threshold = expires_at.timestamp() - skew
        if now.timestamp() >= threshold:
            needs_refresh = True

    if not needs_refresh:
        return data

    if not refresh_token:
        raise BadRequest(
            detail="OAuth2 access token expired and no refresh token is stored. "
            "Reconnect this credential."
        )

    token_url = data.get("token_url")
    client_id = data.get("client_id")
    client_secret = data.get("client_secret")
    if not token_url or not client_id or not client_secret:
        raise BadRequest(
            detail="OAuth2 credential is missing token_url, client_id, or client_secret."
        )

    form = {
        "grant_type": "refresh_token",
        "refresh_token": str(refresh_token),
        "client_id": str(client_id),
        "client_secret": str(client_secret),
    }

    try:
        token_response = await post_oauth_token_form(str(token_url), form)
    except OAuthTokenHttpError as e:
        cleared = clear_oauth_session_tokens(data)
        credential.credential_data = encryptor.encrypt_credential_data(cleared)
        db.add(credential)
        await db.commit()
        await db.refresh(credential)

        err_payload: dict[str, Any] = parse_token_error_json_payload(
            e.content_type, e.body
        )

        if is_invalid_grant_response(e.body, err_payload):
            raise BadRequest(
                detail="OAuth2 refresh failed (session revoked or expired). "
                "Reconnect this credential."
            ) from e
        raise BadRequest(
            detail="OAuth2 token refresh failed. Reconnect this credential or try again."
        ) from e

    if "access_token" not in token_response:
        raise BadRequest(detail="OAuth2 token response missing access_token")

    merged = merge_refresh_tokens(data, token_response)
    credential.credential_data = encryptor.encrypt_credential_data(merged)
    db.add(credential)
    await db.commit()
    await db.refresh(credential)
    return merged
