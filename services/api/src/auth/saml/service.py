"""SAML 2.0 Service Provider business logic.

Wraps ``python3-saml`` (OneLogin) to:
* Build SP metadata XML.
* Initiate SSO (build AuthnRequest → redirect URL).
* Validate IdP assertions (ACS).
* Provide replay-attack protection via Redis.
"""

import base64
import json
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse

from onelogin.saml2.auth import OneLogin_Saml2_Auth
from onelogin.saml2.settings import OneLogin_Saml2_Settings
from redis.asyncio import Redis

from src.auth.saml.keys import SAMLKeyManager
from src.core.config import get_settings
from src.db.models import SAMLConfiguration


# ---------------------------------------------------------------------------
# Data container for attributes extracted from a SAML assertion
# ---------------------------------------------------------------------------


@dataclass
class SAMLAttributes:
    """Normalised user attributes extracted from a validated SAML assertion."""

    name_id: str  # SAML Subject NameID – the IdP's opaque user identifier
    email: str
    name: str
    session_index: Optional[str] = field(default=None)


# ---------------------------------------------------------------------------
# Attribute name aliases used by common IdPs
# ---------------------------------------------------------------------------

_EMAIL_ATTR_NAMES = [
    "email",
    "mail",
    "Email",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "urn:oid:0.9.2342.19200300.100.1.3",  # LDAP mail
]

_NAME_ATTR_NAMES = [
    "displayName",
    "name",
    "cn",
    "fullName",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
    "http://schemas.microsoft.com/identity/claims/displayname",
    "urn:oid:2.5.4.3",  # LDAP cn
]


def _first(attrs: dict, keys: list[str]) -> Optional[str]:
    """Return the first non-empty value found for any of the given attribute keys."""
    for key in keys:
        values = attrs.get(key)
        if values:
            return values[0]
    return None


# ---------------------------------------------------------------------------
# SAMLService
# ---------------------------------------------------------------------------


class SAMLService:
    """Stateless SAML SP service.  Requires a Redis client for relay / replay state."""

    _RELAY_STATE_TTL = 600  # seconds – 10 minutes

    def __init__(self, redis_client: Redis) -> None:
        self._redis = redis_client
        self._settings = get_settings()
        self._key_manager = SAMLKeyManager()

    # ------------------------------------------------------------------
    # Settings construction
    # ------------------------------------------------------------------

    def _build_settings_dict(self, config: SAMLConfiguration) -> dict:
        """Build the python3-saml settings dict for a given SAML configuration."""
        base_url = self._settings.saml_sp_base_url.rstrip("/")

        sp_private_key = self._key_manager.decrypt_sp_key(
            config.sp_private_key_encrypted
        )
        sp_cert = SAMLKeyManager.get_cert_for_saml(config.sp_certificate)
        idp_cert = SAMLKeyManager.get_cert_for_saml(config.idp_certificate)

        return {
            "strict": True,
            "debug": self._settings.environment.value == "dev",
            "sp": {
                "entityId": f"{base_url}/auth/saml/metadata",
                "assertionConsumerService": {
                    "url": f"{base_url}/auth/saml/acs",
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
                },
                "singleLogoutService": {
                    "url": f"{base_url}/auth/saml/slo",
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
                },
                "NameIDFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
                "x509cert": sp_cert,
                "privateKey": sp_private_key,
            },
            "idp": {
                "entityId": config.idp_entity_id,
                "singleSignOnService": {
                    "url": config.idp_sso_url,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
                },
                "singleLogoutService": {
                    "url": config.idp_slo_url or config.idp_sso_url,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
                },
                "x509cert": idp_cert,
            },
            "security": {
                "authnRequestsSigned": True,
                "wantAssertionsSigned": True,
                "wantMessagesSigned": False,
                "wantNameId": True,
                "nameIdEncrypted": False,
                "signMetadata": True,
                "wantAttributeStatement": False,
                "requestedAuthnContext": False,
            },
        }

    @staticmethod
    def _make_request_data(
        *,
        http_host: str,
        is_https: bool,
        path: str,
        get_data: Optional[dict] = None,
        post_data: Optional[dict] = None,
    ) -> dict:
        """Build a python3-saml-compatible request dict."""
        parsed = urlparse(http_host if "://" in http_host else f"http://{http_host}")
        port = parsed.port or (443 if is_https else 80)
        return {
            "https": "on" if is_https else "off",
            "http_host": parsed.hostname or http_host,
            "script_name": path,
            "server_port": str(port),
            "get_data": get_data or {},
            "post_data": post_data or {},
        }

    # ------------------------------------------------------------------
    # SP metadata
    # ------------------------------------------------------------------

    def get_metadata_xml(self, config: SAMLConfiguration) -> str:
        """Generate and validate SP metadata XML for this configuration."""
        settings_dict = self._build_settings_dict(config)
        saml_settings = OneLogin_Saml2_Settings(
            settings=settings_dict, sp_validation_only=True
        )
        metadata = saml_settings.get_sp_metadata()
        errors = saml_settings.validate_metadata(metadata)
        if errors:
            raise ValueError(f"SP metadata validation failed: {errors}")
        return metadata

    # ------------------------------------------------------------------
    # SSO initiation
    # ------------------------------------------------------------------

    async def initiate_sso(
        self,
        config: SAMLConfiguration,
        redirect_url: Optional[str] = None,
    ) -> str:
        """Build an AuthnRequest and return the IdP redirect URL.

        Stores the generated request ID in Redis so we can validate
        ``InResponseTo`` when the assertion arrives at the ACS endpoint.
        """
        parsed = urlparse(self._settings.saml_sp_base_url)
        is_https = parsed.scheme == "https"
        request_data = self._make_request_data(
            http_host=parsed.netloc,
            is_https=is_https,
            path="/auth/saml/login",
        )

        settings_dict = self._build_settings_dict(config)
        auth = OneLogin_Saml2_Auth(request_data, settings_dict)

        relay_state = base64.urlsafe_b64encode(
            json.dumps({"redirect": redirect_url}).encode()
        ).decode()

        sso_url: str = auth.login(return_to=relay_state)

        request_id = auth.get_last_request_id()
        if request_id:
            await self._redis.setex(
                f"saml:request:{request_id}",
                self._RELAY_STATE_TTL,
                "1",  # single IdP – value is kept for replay-protection TTL only
            )

        return sso_url

    # ------------------------------------------------------------------
    # ACS – validate the IdP assertion
    # ------------------------------------------------------------------

    async def process_acs_response(
        self,
        config: SAMLConfiguration,
        saml_response_b64: str,
        relay_state: str,
        request_host: str,
        is_https: bool,
    ) -> SAMLAttributes:
        """Validate the SAML response POSTed to the ACS endpoint.

        Raises:
            ValueError: If the assertion is invalid, expired, or replayed.
        """
        request_data = self._make_request_data(
            http_host=request_host,
            is_https=is_https,
            path="/auth/saml/acs",
            post_data={
                "SAMLResponse": saml_response_b64,
                "RelayState": relay_state,
            },
        )

        settings_dict = self._build_settings_dict(config)
        auth = OneLogin_Saml2_Auth(request_data, settings_dict)
        auth.process_response()

        errors = auth.get_errors()
        if errors:
            reason = auth.get_last_error_reason() or ""
            raise ValueError(
                f"SAML response validation failed: {', '.join(errors)}. {reason}"
            )

        if not auth.is_authenticated():
            raise ValueError("SAML authentication failed: assertion not authenticated")

        # ---- Replay-attack protection ----
        assertion_id = auth.get_last_assertion_id()
        if assertion_id:
            redis_key = f"saml:assertion:{assertion_id}"
            already_used = await self._redis.exists(redis_key)
            if already_used:
                raise ValueError(
                    "SAML replay attack detected: assertion ID already consumed"
                )
            await self._redis.setex(
                redis_key,
                self._settings.saml_assertion_id_ttl,
                "1",
            )

        # ---- Extract normalised attributes ----
        name_id: str = auth.get_nameid() or ""
        attributes: dict = auth.get_attributes()

        email = _first(attributes, _EMAIL_ATTR_NAMES) or name_id
        name = _first(attributes, _NAME_ATTR_NAMES) or email
        session_index = auth.get_session_index()

        return SAMLAttributes(
            name_id=name_id,
            email=email.lower().strip(),
            name=name.strip(),
            session_index=session_index,
        )
