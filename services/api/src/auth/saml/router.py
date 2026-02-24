"""SAML 2.0 SSO router — single-IdP model.

Only one SAML configuration is allowed at a time.  Creating a second one
returns 409 Conflict.  All public endpoints discover the active config
automatically; no ``config_id`` is ever exposed in a URL.

Endpoints
---------
Public (no auth required):
    GET  /auth/saml/metadata   – SP metadata XML (give this URL to Authentik)
    GET  /auth/saml/login      – Initiate SSO redirect to IdP
    POST /auth/saml/acs        – Assertion Consumer Service (IdP posts here)
    POST /auth/saml/slo        – Single Logout (IdP-initiated)
    GET  /auth/saml/discover   – Domain-based IdP discovery

Admin only:
    GET    /auth/saml/config   – Get the current SAML configuration
    POST   /auth/saml/config   – Create the SAML configuration (409 if one exists)
    PUT    /auth/saml/config   – Update the SAML configuration
    DELETE /auth/saml/config   – Delete the SAML configuration
"""

import base64
import json
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Form, Request, Response
from fastapi.responses import RedirectResponse
from sqlmodel import select

from src.auth.saml.keys import SAMLKeyManager
from src.auth.saml.provisioning import SAMLProvisioningService
from src.auth.saml.schemas import (
    SAMLConfigCreate,
    SAMLConfigResponse,
    SAMLConfigUpdate,
    SAMLDiscoverResponse,
)
from src.auth.saml.service import SAMLService
from src.auth.service import AuthService
from src.auth.token_store import TokenStore
from src.core.config import Settings, get_settings
from src.core.dependencies import DatabaseDep, RedisDep, RequireAdminRole
from src.core.exceptions import AlreadyExists, NotFound
from src.core.responses import ApiResponse
from src.db.models import SAMLConfiguration

router = APIRouter(prefix="/auth/saml", tags=["SAML SSO"])


# ---------------------------------------------------------------------------
# Dependency factories
# ---------------------------------------------------------------------------


async def get_saml_service(redis: RedisDep) -> SAMLService:
    return SAMLService(redis_client=redis)


async def get_auth_service(db: DatabaseDep, redis: RedisDep) -> AuthService:
    token_store = TokenStore(redis_client=redis)
    return AuthService(db=db, token_store=token_store)


# ---------------------------------------------------------------------------
# DB helpers — single-IdP lookups
# ---------------------------------------------------------------------------


async def _get_active_config(db) -> Optional[SAMLConfiguration]:
    """Return the single active SAMLConfiguration or None."""
    result = await db.exec(
        select(SAMLConfiguration).where(SAMLConfiguration.is_active == True)  # noqa: E712
    )
    return result.first()


async def _get_any_config(db) -> Optional[SAMLConfiguration]:
    """Return any SAMLConfiguration (active or not) — used for existence checks."""
    result = await db.exec(select(SAMLConfiguration))
    return result.first()


# ---------------------------------------------------------------------------
# Response builder — injects computed SP fields
# ---------------------------------------------------------------------------


def _config_response(
    config: SAMLConfiguration, settings: Settings
) -> SAMLConfigResponse:
    """Build SAMLConfigResponse with computed SP URLs.

    With the single-IdP model the entity ID is a clean, stable URL
    (no numeric suffix) that will not change when the config is recreated.
    """
    base = settings.saml_sp_base_url.rstrip("/")
    return SAMLConfigResponse(
        id=config.id,  # type: ignore[arg-type]
        name=config.name,
        idp_entity_id=config.idp_entity_id,
        idp_sso_url=config.idp_sso_url,
        idp_slo_url=config.idp_slo_url,
        sp_certificate=config.sp_certificate,
        sp_entity_id=f"{base}/auth/saml/metadata",
        sp_acs_url=f"{base}/auth/saml/acs",
        sp_metadata_url=f"{base}/auth/saml/metadata",
        sp_slo_url=f"{base}/auth/saml/slo",
        domain_hint=config.domain_hint,
        is_active=config.is_active,
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


# ---------------------------------------------------------------------------
# Relay-state codec (carries only the optional post-login redirect path)
# ---------------------------------------------------------------------------


def _decode_relay_state(relay_state: str) -> dict:
    """Decode a base64url-encoded JSON relay state string."""
    try:
        padding = 4 - len(relay_state) % 4
        padded = relay_state + ("=" * padding) if padding != 4 else relay_state
        return json.loads(base64.urlsafe_b64decode(padded).decode())
    except Exception:
        return {}


# ===========================================================================
# Public endpoints
# ===========================================================================


@router.get(
    "/metadata",
    response_class=Response,
    summary="SP Metadata XML",
    description=(
        "Return the SP metadata XML for the active SAML configuration. "
        "Enter this URL in your IdP's SP / application settings, or download "
        "and paste the XML manually."
    ),
)
async def sp_metadata(
    db: DatabaseDep,
    saml_service: SAMLService = Depends(get_saml_service),
) -> Response:
    config = await _get_active_config(db)
    if not config:
        raise NotFound(detail="No active SAML configuration found")

    metadata_xml = saml_service.get_metadata_xml(config)
    return Response(
        content=metadata_xml,
        media_type="application/xml",
        headers={"Content-Disposition": 'inline; filename="sp-metadata.xml"'},
    )


@router.get(
    "/login",
    summary="Initiate SSO",
    description=(
        "Redirect the browser to the IdP SSO URL. "
        "Pass ?redirect=/path to land on a specific page after login."
    ),
    status_code=302,
)
async def saml_login(
    db: DatabaseDep,
    redirect: Optional[str] = None,
    saml_service: SAMLService = Depends(get_saml_service),
) -> RedirectResponse:
    config = await _get_active_config(db)
    if not config:
        raise NotFound(detail="No active SAML configuration found")

    sso_url = await saml_service.initiate_sso(config, redirect_url=redirect)
    return RedirectResponse(url=sso_url, status_code=302)


@router.get(
    "/discover",
    response_model=ApiResponse[SAMLDiscoverResponse],
    summary="IdP Discovery",
    description=(
        "Given a user email, return whether SSO is configured for that domain. "
        "The frontend calls this on the login page to detect SSO automatically."
    ),
)
async def discover(
    email: str,
    db: DatabaseDep,
) -> ApiResponse[SAMLDiscoverResponse]:
    domain = email.split("@")[-1].lower().strip() if "@" in email else ""

    config = None
    if domain:
        result = await db.exec(
            select(SAMLConfiguration).where(
                SAMLConfiguration.domain_hint == domain,
                SAMLConfiguration.is_active == True,  # noqa: E712
            )
        )
        config = result.first()

    return ApiResponse(
        success=True,
        message="Discovery complete",
        data=SAMLDiscoverResponse(
            found=config is not None,
            config_id=config.id if config else None,
        ),
    )


@router.post(
    "/acs",
    summary="Assertion Consumer Service",
    description=(
        "Receives the SAML POST assertion from the IdP. "
        "Validates the assertion, provisions/loads the user, sets the auth cookie, "
        "and redirects to the frontend."
    ),
    status_code=302,
)
async def assertion_consumer_service(
    request: Request,
    db: DatabaseDep,
    redis: RedisDep,
    # Form params sent by the IdP (case-sensitive per SAML spec)
    SAMLResponse: str = Form(...),
    RelayState: str = Form(default=""),
    saml_service: SAMLService = Depends(get_saml_service),
    auth_service: AuthService = Depends(get_auth_service),
) -> RedirectResponse:
    settings = get_settings()
    frontend_url = settings.saml_frontend_url.rstrip("/")

    # Relay state only carries the optional post-login redirect path.
    relay_data = _decode_relay_state(RelayState)
    post_login_redirect = relay_data.get("redirect") or "/create"

    # Single-IdP lookup — no config_id needed.
    config = await _get_active_config(db)
    if not config:
        return RedirectResponse(
            url=f"{frontend_url}/saml-callback?status=error&reason=no_active_saml_config",
            status_code=302,
        )

    # python3-saml needs to know the externally-visible host & scheme so the
    # ACS URL it constructs matches what was registered in the IdP.
    parsed = urlparse(settings.saml_sp_base_url)
    is_https = parsed.scheme == "https"
    http_host = parsed.netloc or request.headers.get("host", "localhost")

    # ------------------------------------------------------------------
    # Validate assertion
    # ------------------------------------------------------------------
    try:
        attrs = await saml_service.process_acs_response(
            config=config,
            saml_response_b64=SAMLResponse,
            relay_state=RelayState,
            request_host=http_host,
            is_https=is_https,
        )
    except ValueError as exc:
        safe_reason = str(exc)[:120].replace("&", "%26").replace("=", "%3D")
        return RedirectResponse(
            url=f"{frontend_url}/saml-callback?status=error&reason={safe_reason}",
            status_code=302,
        )

    # ------------------------------------------------------------------
    # JIT provisioning / user load
    # ------------------------------------------------------------------
    provisioner = SAMLProvisioningService(db=db)
    user = await provisioner.get_or_create_saml_user(attrs=attrs, config=config)

    if not user.is_active:
        return RedirectResponse(
            url=f"{frontend_url}/saml-callback?status=error&reason=account_disabled",
            status_code=302,
        )

    # ------------------------------------------------------------------
    # Issue tokens (re-uses existing JWT + Redis machinery)
    # ------------------------------------------------------------------
    token_response = await auth_service.create_auth_response(user)

    # ------------------------------------------------------------------
    # Redirect to frontend SAML callback page.
    # The refresh token is passed as a query param so JS can store it in
    # localStorage (identical to the standard login flow).
    # The access token is delivered as an HTTP-only cookie.
    # ------------------------------------------------------------------
    callback_url = (
        f"{frontend_url}/saml-callback"
        f"?status=ok"
        f"&refresh_token={token_response.refresh_token}"
        f"&expires_in={token_response.expires_in}"
        f"&redirect={post_login_redirect}"
    )

    response = RedirectResponse(url=callback_url, status_code=302)
    response.set_cookie(
        key=settings.cookie_name,
        value=token_response.access_token,
        httponly=True,
        secure=settings.cookie_secure,
        max_age=settings.access_token_expire_minutes * 60,
        samesite="lax",
    )
    return response


@router.post(
    "/slo",
    summary="Single Logout",
    description="Handle IdP-initiated Single Logout. Clears the auth cookie.",
)
async def single_logout(
    request: Request,
) -> Response:
    settings = get_settings()
    response = Response(content="Logged out", status_code=200)
    response.delete_cookie(
        key=settings.cookie_name,
        httponly=True,
        secure=settings.cookie_secure,
    )
    return response


# ===========================================================================
# Admin-only SAML configuration management (single config)
# ===========================================================================


@router.get(
    "/config",
    response_model=ApiResponse[SAMLConfigResponse],
    summary="Get SAML configuration",
    description="Return the current SAML IdP configuration.",
)
async def get_saml_config(
    db: DatabaseDep,
    _: RequireAdminRole,
) -> ApiResponse[SAMLConfigResponse]:
    settings = get_settings()
    config = await _get_any_config(db)
    if not config:
        raise NotFound(detail="No SAML configuration found")

    return ApiResponse(
        success=True,
        message="SAML configuration retrieved",
        data=_config_response(config, settings),
    )


@router.post(
    "/config",
    response_model=ApiResponse[SAMLConfigResponse],
    status_code=201,
    summary="Create SAML configuration",
    description=(
        "Create the SAML IdP integration for this deployment. "
        "Only one configuration is permitted — call DELETE first to replace it. "
        "The SP keypair is generated automatically. "
        "Copy ``sp_entity_id``, ``sp_acs_url``, and ``sp_certificate`` into your IdP."
    ),
)
async def create_saml_config(
    payload: SAMLConfigCreate,
    db: DatabaseDep,
    _: RequireAdminRole,
) -> ApiResponse[SAMLConfigResponse]:
    existing = await _get_any_config(db)
    if existing:
        raise AlreadyExists(
            detail=(
                "A SAML configuration already exists. "
                "Delete it via DELETE /auth/saml/config before creating a new one."
            )
        )

    settings = get_settings()
    key_manager = SAMLKeyManager()
    encrypted_key, cert_pem = key_manager.generate_sp_keypair()

    config = SAMLConfiguration(
        name=payload.name,
        idp_entity_id=payload.idp_entity_id,
        idp_sso_url=payload.idp_sso_url,
        idp_slo_url=payload.idp_slo_url,
        idp_certificate=payload.idp_certificate,
        sp_private_key_encrypted=encrypted_key,
        sp_certificate=cert_pem,
        domain_hint=payload.domain_hint.lower().strip()
        if payload.domain_hint
        else None,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)

    return ApiResponse(
        success=True,
        message="SAML configuration created",
        data=_config_response(config, settings),
    )


@router.put(
    "/config",
    response_model=ApiResponse[SAMLConfigResponse],
    summary="Update SAML configuration",
    description="Update the existing SAML configuration. Only supplied fields are changed.",
)
async def update_saml_config(
    payload: SAMLConfigUpdate,
    db: DatabaseDep,
    _: RequireAdminRole,
) -> ApiResponse[SAMLConfigResponse]:
    settings = get_settings()
    config = await _get_any_config(db)
    if not config:
        raise NotFound(detail="No SAML configuration found")

    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(config, field_name, value)

    db.add(config)
    await db.commit()
    await db.refresh(config)

    return ApiResponse(
        success=True,
        message="SAML configuration updated",
        data=_config_response(config, settings),
    )


@router.delete(
    "/config",
    response_model=ApiResponse[None],
    summary="Delete SAML configuration",
    description=(
        "Permanently delete the SAML configuration. "
        "Existing SAML-provisioned users keep their accounts but can no longer log in "
        "until a new configuration is created. "
        "To recreate, call POST /auth/saml/config."
    ),
)
async def delete_saml_config(
    db: DatabaseDep,
    _: RequireAdminRole,
) -> ApiResponse[None]:
    config = await _get_any_config(db)
    if not config:
        raise NotFound(detail="No SAML configuration found")

    await db.delete(config)
    await db.commit()

    return ApiResponse(
        success=True,
        message="SAML configuration deleted",
        data=None,
    )
