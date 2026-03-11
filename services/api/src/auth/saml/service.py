import base64
import hashlib
import hmac
import json
from typing import Optional
from urllib.parse import urlparse

from onelogin.saml2.auth import OneLogin_Saml2_Auth
from onelogin.saml2.settings import OneLogin_Saml2_Settings
from redis.asyncio import Redis
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.auth.saml.keys import SAMLKeyManager
from src.auth.saml.schemas import SAMLAttributes
from src.core.config import get_settings
from src.db.models import SAMLConfiguration


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

        Raises RuntimeError if jwt_secret_key is not configured, as an empty
        or None key would silently disable relay state integrity protection.
        """
        if not self._settings.jwt_secret_key:
            raise RuntimeError(
                "jwt_secret_key must be set in environment config — "
                "SAML relay state signing requires a non-empty secret."
            )
        secret = self._settings.jwt_secret_key.encode()
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
                # Sign outgoing SLO messages so the IdP can verify them.
                "logoutRequestSigned": True,
                "logoutResponseSigned": True,
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

    # ------------------------------------------------------------------
    # Database helpers
    # ------------------------------------------------------------------

    async def get_active_config(self, db: AsyncSession) -> Optional[SAMLConfiguration]:
        """Return the single active SAMLConfiguration, or None."""
        result = await db.exec(
            select(SAMLConfiguration).where(SAMLConfiguration.is_active == True)  # noqa: E712
        )
        return result.first()

    async def get_any_config(self, db: AsyncSession) -> Optional[SAMLConfiguration]:
        """Return any SAMLConfiguration (active or not) — used for existence checks."""
        result = await db.exec(select(SAMLConfiguration))
        return result.first()

    # ------------------------------------------------------------------
    # SAML session store — maps NameID to user so SLO can revoke tokens
    # ------------------------------------------------------------------

    async def store_saml_session(
        self,
        name_id: str,
        session_index: Optional[str],
        user_id: int,
    ) -> None:
        """Persist a NameID → user_id mapping in Redis for SLO revocation.

        The key is a SHA-256 hash of the NameID to avoid storing raw IdP
        identifiers in Redis.  TTL matches the refresh token lifetime.
        """
        hashed = hashlib.sha256(name_id.encode()).hexdigest()
        ttl = self._settings.refresh_token_expire_days * 24 * 3600
        value = json.dumps({"user_id": user_id, "session_index": session_index})
        await self._redis.setex(f"saml:session:{hashed}", ttl, value)

    async def get_user_id_for_slo(self, name_id: str) -> Optional[int]:
        """Return the user_id stored for *name_id*, or None if not found."""
        hashed = hashlib.sha256(name_id.encode()).hexdigest()
        raw = await self._redis.get(f"saml:session:{hashed}")
        if not raw:
            return None
        try:
            return int(json.loads(raw)["user_id"])
        except (KeyError, ValueError, TypeError):
            return None

    async def delete_saml_session(self, name_id: str) -> None:
        """Remove the stored NameID session entry after a successful SLO."""
        hashed = hashlib.sha256(name_id.encode()).hexdigest()
        await self._redis.delete(f"saml:session:{hashed}")

    # ------------------------------------------------------------------
    # SLO — validate IdP-initiated LogoutRequest
    # ------------------------------------------------------------------

    async def process_slo_request(
        self,
        config: SAMLConfiguration,
        request_host: str,
        is_https: bool,
        get_data: dict,
    ) -> tuple[str, Optional[int]]:
        """Validate an IdP-initiated SLO LogoutRequest (HTTP-Redirect binding).

        Verifies the IdP's signature before doing anything else.  A missing or
        invalid signature raises ``ValueError`` so the router can return 400
        without touching the user's session.

        Returns:
            (redirect_url, user_id) where *redirect_url* is the IdP SLO URL
            with the signed LogoutResponse appended, and *user_id* is the
            affected user (None if the session mapping has expired).

        Raises:
            ValueError: On any validation failure (missing signature, bad MAC,
                        invalid request structure, etc.).
        """
        # Require Signature + SigAlg for Redirect binding
        if not get_data.get("Signature") or not get_data.get("SigAlg"):
            raise ValueError(
                "SLO LogoutRequest must be signed with SigAlg and Signature"
            )

        request_data = self._make_request_data(
            http_host=request_host,
            is_https=is_https,
            path="/auth/saml/slo",
            get_data=get_data,
        )

        settings_dict = self._build_settings_dict(config)
        auth = OneLogin_Saml2_Auth(request_data, settings_dict)

        # Process SLO using python3-saml. Keep local session management in our code.
        redirect_url: Optional[str] = auth.process_slo(keep_local_session=True)

        errors = auth.get_errors()
        if errors:
            reason = auth.get_last_error_reason() or ""
            raise ValueError(f"SLO LogoutRequest validation failed: {errors} {reason}")

        # Extract NameID so we can revoke the user's tokens.
        name_id: Optional[str] = auth.get_nameid()
        slo_session_index: Optional[str] = auth.get_session_index()
        user_id: Optional[int] = None
        if name_id:
            hashed = hashlib.sha256(name_id.encode()).hexdigest()
            stored_raw = await self._redis.get(f"saml:session:{hashed}")
            if stored_raw:
                try:
                    stored = json.loads(stored_raw)
                    user_id = int(stored["user_id"])
                    stored_session_index: Optional[str] = stored.get("session_index")
                    # If both session_index values exist and differ, continue
                    # to revoke anyway (single-session model), but note it.
                    if (
                        slo_session_index
                        and stored_session_index
                        and slo_session_index != stored_session_index
                    ):
                        # mismatch — still revoke
                        pass
                except (KeyError, ValueError, TypeError):
                    # malformed stored session — continue with best-effort revoke
                    pass
            await self.delete_saml_session(name_id)
        # Fallback redirect if python3-saml didn't produce one
        fallback = config.idp_slo_url or config.idp_sso_url
        return redirect_url or fallback, user_id
