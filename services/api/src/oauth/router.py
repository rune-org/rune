from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.config import get_settings
from src.core.dependencies import RequirePasswordChanged
from src.core.exceptions import BadRequest, Forbidden
from src.credentials.encryption import get_encryptor
from src.credentials.permissions import CredentialPermissionService
from src.db.config import get_db
from src.db.models import CredentialType, User, WorkflowCredential
from src.oauth.credential_tokens import merge_authorization_code_tokens
from src.oauth.state import decode_oauth_state, encode_oauth_state
from src.oauth.token_exchange import OAuthTokenHttpError, post_oauth_token_form

router = APIRouter(prefix="/oauth", tags=["oauth"])


def _callback_redirect_uri() -> str:
    settings = get_settings()
    if settings.oauth_redirect_uri:
        return settings.oauth_redirect_uri.strip()
    base = settings.api_public_url.rstrip("/")
    return f"{base}/oauth/callback"


def _append_query(url: str, extra: dict[str, str]) -> str:
    parts = urlparse(url)
    q = dict(parse_qsl(parts.query, keep_blank_values=True))
    for k, v in extra.items():
        q[k] = v
    new_query = urlencode(q)
    return urlunparse(
        (parts.scheme, parts.netloc, parts.path, parts.params, new_query, parts.fragment)
    )


def _merge_authorize_query_params(auth_url: str, params: dict[str, str]) -> str:
    parts = urlparse(auth_url)
    existing = dict(parse_qsl(parts.query, keep_blank_values=True))
    for k, v in params.items():
        if v != "":
            existing[k] = v
    new_query = urlencode(existing)
    return urlunparse(
        (parts.scheme, parts.netloc, parts.path, parts.params, new_query, parts.fragment)
    )


@router.get("/authorize")
async def oauth_authorize(
    current_user: RequirePasswordChanged,
    credential_id: int = Query(..., ge=1),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Start OAuth2 authorization code flow for a saved oauth2 credential."""
    credential = await db.get(WorkflowCredential, credential_id)
    if not credential or credential.credential_type != CredentialType.OAUTH2:
        raise BadRequest(detail="OAuth2 credential not found")

    perm = CredentialPermissionService(db)
    await perm.require_edit_access(credential, current_user)

    encryptor = get_encryptor()
    data = encryptor.decrypt_credential_data(credential.credential_data)

    auth_url = data.get("auth_url")
    client_id = data.get("client_id")
    token_url = data.get("token_url")
    if not auth_url or not client_id or not token_url:
        raise BadRequest(
            detail="Credential must include auth_url, client_id, and token_url before Connect."
        )

    redirect_uri = _callback_redirect_uri()
    state = encode_oauth_state(credential_id, current_user.id)

    qparams: dict[str, str] = {
        "response_type": "code",
        "client_id": str(client_id),
        "redirect_uri": redirect_uri,
        "state": state,
    }
    scope = data.get("scope")
    if scope:
        qparams["scope"] = str(scope)

    location = _merge_authorize_query_params(str(auth_url), qparams)
    return RedirectResponse(url=location, status_code=302)


@router.get("/callback")
async def oauth_callback(
    db: AsyncSession = Depends(get_db),
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
) -> RedirectResponse:
    """OAuth2 redirect URI: exchange code and merge tokens into the credential."""
    settings = get_settings()
    err_base = settings.oauth_frontend_error_url
    ok_base = settings.oauth_frontend_success_url

    def err_redirect(reason: str) -> RedirectResponse:
        url = _append_query(err_base, {"oauth": "error", "reason": reason})
        return RedirectResponse(url=url, status_code=302)

    def ok_redirect(cid: int) -> RedirectResponse:
        url = _append_query(
            ok_base,
            {"oauth": "success", "credential_id": str(cid)},
        )
        return RedirectResponse(url=url, status_code=302)

    if error:
        msg = (error_description or error)[:300]
        return err_redirect(msg or "provider_error")

    if not code or not state:
        return err_redirect("missing_code_or_state")

    try:
        credential_id, user_id = decode_oauth_state(state)
    except BadRequest as e:
        detail = str(e.detail) if e.detail else "invalid_state"
        return err_redirect(detail[:300])

    user = await db.get(User, user_id)
    if not user:
        return err_redirect("unknown_user")

    credential = await db.get(WorkflowCredential, credential_id)
    if not credential or credential.credential_type != CredentialType.OAUTH2:
        return err_redirect("invalid_credential")

    perm = CredentialPermissionService(db)
    try:
        await perm.require_edit_access(credential, user)
    except Forbidden:
        return err_redirect("forbidden")

    encryptor = get_encryptor()
    data = encryptor.decrypt_credential_data(credential.credential_data)

    token_url = data.get("token_url")
    client_id = data.get("client_id")
    client_secret = data.get("client_secret")
    if not token_url or not client_id or not client_secret:
        return err_redirect("incomplete_credential_config")

    redirect_uri = _callback_redirect_uri()
    form = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": str(client_id),
        "client_secret": str(client_secret),
    }

    try:
        token_response = await post_oauth_token_form(str(token_url), form)
    except OAuthTokenHttpError:
        return err_redirect("token_exchange_failed")

    if "access_token" not in token_response:
        return err_redirect("token_response_invalid")

    merged = merge_authorization_code_tokens(data, token_response)
    credential.credential_data = encryptor.encrypt_credential_data(merged)
    db.add(credential)
    await db.commit()

    return ok_redirect(credential.id)
