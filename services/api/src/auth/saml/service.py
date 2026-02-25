"""SAML 2.0 Service Provider business logic.

Wraps ``python3-saml`` (OneLogin) to:
* Build SP metadata XML.
* Initiate SSO (build AuthnRequest → redirect URL).
* Validate IdP assertions (ACS).
* Provide replay-attack protection via Redis.

Production hardening:
* Relay state is HMAC-signed (SHA-256) so a malicious actor cannot forge it at
  the ACS endpoint and inject an arbitrary post-login redirect path.
* Relay state size is bounded (guards against header-too-large attacks).
* Assertion IDs are consumed in Redis with the configured TTL to prevent replay.
"""

import base64
import hashlib
import hmac
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

# Maximum relay state payload size (bytes). Prevents header-too-large DoS.
_MAX_RELAY_STATE_BYTES = 512


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
    # Relay state — signed with HMAC-SHA256 using the JWT secret
    # ------------------------------------------------------------------

    def _relay_state_secret(self) -> bytes:
        """Derive a signing secret for relay states from the JWT secret.

        Using a dedicated sub-key avoids mixing contexts, but keeps the
        secret count down to one master secret in .env.
        """
        secret = (self._settings.jwt_secret_key or "").encode()
        return hashlib.sha256(b"saml-relay-state:" + secret).digest()

    def _sign_relay_state(self, payload: dict) -> str:
        """Encode *payload* as base64url JSON and append an HMAC-SHA256 MAC.

        Wire format:  ``<base64url(json)>.<base64url(hmac)>``
        """
        raw = (
            base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
        )
        mac = hmac.new(
            self._relay_state_secret(), raw.encode(), hashlib.sha256
        ).digest()
        mac_b64 = base64.urlsafe_b64encode(mac).decode().rstrip("=")
        signed = f"{raw}.{mac_b64}"
        if len(signed.encode()) > _MAX_RELAY_STATE_BYTES:
            # Fall back to an empty payload rather than truncating (could corrupt JSON).
            return self._sign_relay_state({})
        return signed

    def _verify_relay_state(self, token: str) -> dict:
        """Verify the MAC and return the decoded payload, or ``{}`` on any failure.

        Returning an empty dict (not raising) means the worst outcome of a bad
        relay state is that the user lands on the default post-login page --
        never an error screen or a security exception.
        """
        if not token:
            return {}
        try:
            parts = token.split(".", 1)
            if len(parts) != 2:
                return {}
            raw, mac_b64 = parts
            expected_mac = hmac.new(
                self._relay_state_secret(), raw.encode(), hashlib.sha256
            ).digest()
            received_mac = base64.urlsafe_b64decode(mac_b64 + "==")
            if not hmac.compare_digest(expected_mac, received_mac):
                return {}
            payload_bytes = base64.urlsafe_b64decode(raw + "==")
            return json.loads(payload_bytes.decode())
        except Exception:
            return {}

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
        The relay state is HMAC-signed to prevent forgery.
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

        relay_state = self._sign_relay_state({"redirect": redirect_url})
        sso_url: str = auth.login(return_to=relay_state)

        request_id = auth.get_last_request_id()
        if request_id:
            await self._redis.setex(
                f"saml:request:{request_id}",
                self._RELAY_STATE_TTL,
                "1",
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
            raise ValueError("SAML assertion validation failed")

        if not auth.is_authenticated():
            raise ValueError("SAML authentication failed")

        # ---- Replay-attack protection ----
        assertion_id = auth.get_last_assertion_id()
        if assertion_id:
            redis_key = f"saml:assertion:{assertion_id}"
            already_used = await self._redis.exists(redis_key)
            if already_used:
                raise ValueError(
                    "SAML replay attack detected: assertion already consumed"
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

    # ------------------------------------------------------------------
    # Relay state — public decode (used by router after verification)
    # ------------------------------------------------------------------

    def decode_relay_state(self, token: str) -> dict:
        """Verify the MAC and return decoded relay state payload.

        Always returns a dict (empty on failure) so callers can safely call
        ``.get("redirect")`` without error-handling.
        """
        return self._verify_relay_state(token)
