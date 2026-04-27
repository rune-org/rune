"""Provider-specific parameters for the OAuth2 authorization request (RFC 6749 §3.1)."""

from urllib.parse import urlparse


def extra_authorize_query_params(authorization_endpoint_url: str) -> dict[str, str]:
    """
    Return extra query keys to merge into the authorize redirect.

    Kept out of the HTTP router so provider rules stay in one place and the
    route handler stays orchestration-only. Add other hosts here as needed
    (e.g. Microsoft login.microsoftonline.com quirks).
    """
    host = (urlparse(authorization_endpoint_url).hostname or "").lower()
    if host == "google.com" or host.endswith(".google.com"):
        # Refresh token is only returned with offline access; repeat connects
        # often need an explicit consent prompt or Google omits refresh_token.
        # https://developers.google.com/identity/protocols/oauth2/web-server#offline
        return {
            "access_type": "offline",
            "prompt": "consent",
        }
    return {}
