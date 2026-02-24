"""Pydantic schemas for SAML SSO endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Admin CRUD request / response schemas
# ---------------------------------------------------------------------------


class SAMLConfigCreate(BaseModel):
    """Request body for ``POST /auth/saml/configs``."""

    name: str = Field(..., description="Display name, e.g. 'Okta' or 'Azure AD'")
    idp_entity_id: str = Field(..., description="IdP Entity ID from their metadata XML")
    idp_sso_url: str = Field(..., description="IdP SSO redirect-binding URL")
    idp_slo_url: Optional[str] = Field(
        default=None, description="IdP Single Logout URL (optional)"
    )
    idp_certificate: str = Field(
        ..., description="IdP X.509 signing certificate, full PEM with headers"
    )
    domain_hint: Optional[str] = Field(
        default=None,
        description="Email domain for SSO auto-discovery, e.g. 'acme.com'",
    )


class SAMLConfigUpdate(BaseModel):
    """Request body for ``PUT /auth/saml/configs/{id}``."""

    name: Optional[str] = None
    idp_entity_id: Optional[str] = None
    idp_sso_url: Optional[str] = None
    idp_slo_url: Optional[str] = None
    idp_certificate: Optional[str] = None
    domain_hint: Optional[str] = None
    is_active: Optional[bool] = None


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
    # ---- computed at response time from SAML_SP_BASE_URL + config.id ----
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
# Discovery schema
# ---------------------------------------------------------------------------


class SAMLDiscoverResponse(BaseModel):
    """Response for ``GET /auth/saml/discover``."""

    found: bool = Field(
        ..., description="Whether a SAML config was found for the domain"
    )
    config_id: Optional[int] = Field(
        default=None, description="SAML config ID to redirect the user to, if found"
    )
