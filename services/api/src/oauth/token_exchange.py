import json
from typing import Any

import httpx


def content_type_indicates_json(value: str | None) -> bool:
    """
    True when the response declares a JSON body (RFC 7231 Media-Type, ignore parameters).
    """
    if not value or not value.strip():
        return False
    main = value.split(";", maxsplit=1)[0].strip().lower()
    return main == "application/json" or main.endswith("+json")


def parse_token_error_json_payload(content_type: str | None, body: str) -> dict[str, Any]:
    """Parse token-endpoint error body as JSON only when Content-Type allows it."""
    if not content_type_indicates_json(content_type):
        return {}
    try:
        parsed: Any = json.loads(body)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


class OAuthTokenHttpError(Exception):
    """Token endpoint returned a non-success status or unreadable body."""

    def __init__(
        self,
        status_code: int,
        body: str,
        *,
        content_type: str | None = None,
    ):
        self.status_code = status_code
        self.body = body
        self.content_type = content_type
        super().__init__(f"OAuth token HTTP {status_code}: {body[:500]}")


async def post_oauth_token_form(url: str, form: dict[str, str]) -> dict[str, Any]:
    """
    POST application/x-www-form-urlencoded to an OAuth2 token endpoint.

    Separated for tests to monkeypatch.
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            data=form,
            headers={"Accept": "application/json"},
            timeout=30.0,
        )

    text = response.text
    ctype = response.headers.get("content-type")
    if response.status_code >= 400:
        raise OAuthTokenHttpError(
            response.status_code, text, content_type=ctype
        )

    try:
        data = response.json()
    except Exception as e:
        raise OAuthTokenHttpError(
            response.status_code,
            f"Non-JSON token response: {text[:500]}",
            content_type=ctype,
        ) from e

    if not isinstance(data, dict):
        raise OAuthTokenHttpError(
            response.status_code,
            f"Unexpected JSON: {text[:500]}",
            content_type=ctype,
        )
    return data
