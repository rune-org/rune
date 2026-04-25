from datetime import datetime, timedelta, timezone
from typing import Any

def merge_authorization_code_tokens(
    existing: dict[str, Any], token_response: dict[str, Any]
) -> dict[str, Any]:
    """Merge token fields from authorization-code exchange into stored credential_data."""
    merged = {**existing}
    if "access_token" in token_response:
        merged["access_token"] = token_response["access_token"]
    if "refresh_token" in token_response and token_response["refresh_token"]:
        merged["refresh_token"] = token_response["refresh_token"]
    if "token_type" in token_response and token_response["token_type"]:
        merged["token_type"] = str(token_response["token_type"])
    expires_in = token_response.get("expires_in")
    if expires_in is not None:
        try:
            seconds = int(expires_in)
        except (TypeError, ValueError):
            seconds = 0
        merged["expires_at"] = (
            datetime.now(timezone.utc) + timedelta(seconds=seconds)
        ).isoformat()
    return merged


def merge_refresh_tokens(
    existing: dict[str, Any], token_response: dict[str, Any]
) -> dict[str, Any]:
    """Merge token fields from refresh_token grant (refresh may rotate refresh_token)."""
    merged = {**existing}
    if "access_token" in token_response:
        merged["access_token"] = token_response["access_token"]
    if "refresh_token" in token_response and token_response["refresh_token"]:
        merged["refresh_token"] = token_response["refresh_token"]
    if "token_type" in token_response and token_response["token_type"]:
        merged["token_type"] = str(token_response["token_type"])
    expires_in = token_response.get("expires_in")
    if expires_in is not None:
        try:
            seconds = int(expires_in)
        except (TypeError, ValueError):
            seconds = 0
        merged["expires_at"] = (
            datetime.now(timezone.utc) + timedelta(seconds=seconds)
        ).isoformat()
    return merged


def clear_oauth_session_tokens(data: dict[str, Any]) -> dict[str, Any]:
    out = {**data}
    for key in ("access_token", "refresh_token", "expires_at", "token_type"):
        out.pop(key, None)
    return out


def oauth2_worker_public_values(decrypted: dict[str, Any]) -> dict[str, Any]:
    """Subset of credential_data safe to send to the worker (merged with type by executor)."""
    token_type = decrypted.get("token_type") or "Bearer"
    return {
        "access_token": decrypted.get("access_token") or "",
        "token_type": str(token_type),
    }


def is_invalid_grant_response(body: str, payload: dict[str, Any]) -> bool:
    if "invalid_grant" in body.lower():
        return True
    err = payload.get("error")
    if isinstance(err, str) and err.lower() == "invalid_grant":
        return True
    return False
