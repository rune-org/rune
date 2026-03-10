from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from src.auth.saml.validators import validate_idp_url, validate_pem_certificate


# ---------------------------------------------------------------------------
# Admin CRUD request / response schemas
# ---------------------------------------------------------------------------


class SAMLConfigCreate(BaseModel):
    """Request body for ``POST /auth/saml/config``."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=80,
        description="Display name, e.g. 'Okta' or 'Azure AD'",
    )
    idp_entity_id: str = Field(
        ...,
        min_length=1,
        max_length=512,
        description="IdP Entity ID from their metadata XML",
    )
    idp_sso_url: str = Field(
        ...,
        description="IdP SSO redirect-binding URL (must be http/https)",
    )
    idp_slo_url: Optional[str] = Field(
        default=None,
        description="IdP Single Logout URL (optional, must be http/https)",
    )
    idp_certificate: str = Field(
        ...,
        description="IdP X.509 signing certificate — full PEM including BEGIN/END headers",
    )
    domain_hint: Optional[str] = Field(
        default=None,
        max_length=253,  # RFC 1035 max domain length
        description="Email domain for SSO auto-discovery, e.g. 'acme.com'",
    )

    @field_validator("idp_sso_url")
    @classmethod
    def validate_sso_url(cls, v: str) -> str:
        return validate_idp_url(v, "idp_sso_url")  # type: ignore[return-value]

    @field_validator("idp_slo_url")
    @classmethod
    def validate_slo_url(cls, v: Optional[str]) -> Optional[str]:
        return validate_idp_url(v, "idp_slo_url")

    @field_validator("idp_certificate")
    @classmethod
    def validate_certificate(cls, v: str) -> str:
        return validate_pem_certificate(v)

    @field_validator("domain_hint")
    @classmethod
    def normalise_domain_hint(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip().lower()
        # Reject anything that doesn't look like a domain label
        if not v or " " in v or v.startswith("-") or v.endswith("-"):
            raise ValueError(
                "domain_hint must be a valid domain name (e.g. 'rune.com')"
            )
        return v


class SAMLConfigUpdate(BaseModel):
    """Request body for ``PUT /auth/saml/config``."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    idp_entity_id: Optional[str] = Field(default=None, min_length=1, max_length=512)
    idp_sso_url: Optional[str] = None
    idp_slo_url: Optional[str] = None
    idp_certificate: Optional[str] = None
    domain_hint: Optional[str] = Field(default=None, max_length=253)
    is_active: Optional[bool] = None

    @field_validator("idp_sso_url")
    @classmethod
    def validate_sso_url(cls, v: Optional[str]) -> Optional[str]:
        return validate_idp_url(v, "idp_sso_url")

    @field_validator("idp_slo_url")
    @classmethod
    def validate_slo_url(cls, v: Optional[str]) -> Optional[str]:
        return validate_idp_url(v, "idp_slo_url")

    @field_validator("idp_certificate")
    @classmethod
    def validate_certificate(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return validate_pem_certificate(v)

    @field_validator("domain_hint")
    @classmethod
    def normalise_domain_hint(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return v.strip().lower()


class SAMLConfigResponse(BaseModel):
    """Admin-facing response for a SAML configuration.

    Includes all IdP fields plus computed SP fields that admins need to paste
    into their IdP when setting up the integration.  The SP private key is
    intentionally excluded.
    """

    id: int
    name: str

    # IdP fields (stored in DB)
    idp_entity_id: str
    idp_sso_url: str
    idp_slo_url: Optional[str] = None

    # SP fields returned for admin setup
    # ---- stored ----
    sp_certificate: str = Field(
        description="SP X.509 certificate PEM – paste into your IdP"
    )
    # ---- computed at response time from SAML_SP_BASE_URL ----
    sp_entity_id: str = Field(
        description="SP Entity ID / Audience URI to enter in your IdP"
    )
    sp_acs_url: str = Field(
        description="Assertion Consumer Service URL to enter in your IdP"
    )
    sp_metadata_url: str = Field(
        description="Public URL of this SP's metadata XML – paste into your IdP to auto-configure"
    )
    sp_slo_url: str = Field(
        description="Single Logout URL to configure in your IdP (optional)"
    )

    domain_hint: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Code-exchange schemas (one-time SSO token hand-off)
# ---------------------------------------------------------------------------


class SAMLExchangeRequest(BaseModel):
    """Request body for ``POST /auth/saml/exchange``."""

    code: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="One-time SSO exchange code received as a URL query parameter after IdP redirect",
    )


class SAMLExchangeResponse(BaseModel):
    """Response body for ``POST /auth/saml/exchange``.

    The access token is delivered as an ``HttpOnly`` cookie on the same
    response — it never appears in this JSON body.
    """

    refresh_token: str = Field(
        ..., description="Long-lived refresh token — store in localStorage"
    )
    expires_in: int = Field(..., description="Access token lifetime in seconds")


# ---------------------------------------------------------------------------
# Discovery schema
# ---------------------------------------------------------------------------


class SAMLDiscoverResponse(BaseModel):
    """Response for ``GET /auth/saml/discover``.

    Intentionally does **not** expose internal IDs — the single-IdP model
    means the login endpoint is always ``/auth/saml/login`` regardless.
    """

    found: bool = Field(
        ...,
        description="Whether an active SAML config exists for this email domain",
    )
    login_url: Optional[str] = Field(
        default=None,
        description="SSO initiation URL to redirect the user to, if found",
    )


# ---------------------------------------------------------------------------
# SAML assertion attributes (data container, not a wire-format schema)
# ---------------------------------------------------------------------------


@dataclass
class SAMLAttributes:
    """Normalised user attributes extracted from a validated SAML assertion."""

    name_id: str  # SAML Subject NameID – the IdP's opaque user identifier
    email: str
    name: str
    session_index: Optional[str] = field(default=None)
