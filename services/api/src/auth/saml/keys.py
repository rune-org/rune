"""SAML Service Provider (SP) keypair management.

Generates and manages the RSA private key + self-signed X.509 certificate that
the SP (RUNE API) uses to sign AuthnRequests and optionally to decrypt
assertions.  The private key is never stored in plaintext: it is Fernet-
encrypted using the application's ENCRYPTION_KEY before being written to the
database.

Production hardening applied:
- RSA-4096 key (NIST SP 800-131A Rev 2 compliant through 2030+).
- 3-year certificate validity (reduces blast radius of key compromise vs 10 yr).
- KeyUsage + ExtendedKeyUsage extensions set for strict IdP validation.
- SubjectKeyIdentifier added for chain-building compatibility.
"""

from datetime import datetime, timedelta, timezone

from cryptography import x509
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

from src.core.config import get_settings


def _strip_pem_headers(pem: str) -> str:
    """Remove PEM armor headers / footers.

    python3-saml expects raw base64 content without the
    ``-----BEGIN …-----`` / ``-----END …-----`` wrappers.
    """
    lines = pem.strip().splitlines()
    return "".join(line for line in lines if not line.startswith("-----"))


class SAMLKeyManager:
    """Handles SP keypair generation, encryption, and decryption."""

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.encryption_key:
            raise ValueError(
                "ENCRYPTION_KEY must be set in environment variables for SAML key management"
            )
        self._fernet = Fernet(settings.encryption_key.encode())

    # ------------------------------------------------------------------
    # Public helpers
    # ------------------------------------------------------------------

    def generate_sp_keypair(self) -> tuple[str, str]:
        """Generate a new RSA-2048 private key + self-signed X.509 certificate.

        Returns:
            ``(encrypted_private_key_pem, certificate_pem)``

            *encrypted_private_key_pem* – Fernet-encrypted PEM string suitable
            for direct DB storage.

            *certificate_pem* – Full PEM (with headers) for DB storage.  Use
            :meth:`get_cert_for_saml` to strip headers before passing to
            python3-saml.
        """
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=4096,  # NIST SP 800-131A Rev 2 recommended minimum for 2030+
        )

        subject = issuer = x509.Name(
            [
                x509.NameAttribute(NameOID.COMMON_NAME, "RUNE SAML SP"),
                x509.NameAttribute(NameOID.ORGANIZATION_NAME, "RUNE"),
            ]
        )

        now = datetime.now(timezone.utc)
        pub_key = private_key.public_key()
        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(pub_key)
            .serial_number(x509.random_serial_number())
            .not_valid_before(now)
            .not_valid_after(now + timedelta(days=1095))  # 3 years (not 10)
            # CA:FALSE — this cert signs SAML messages, not other certs.
            .add_extension(
                x509.BasicConstraints(ca=False, path_length=None),
                critical=True,
            )
            # Restrict key usage to digital signatures only.
            .add_extension(
                x509.KeyUsage(
                    digital_signature=True,
                    content_commitment=True,  # non-repudiation
                    key_encipherment=False,
                    data_encipherment=False,
                    key_agreement=False,
                    key_cert_sign=False,
                    crl_sign=False,
                    encipher_only=False,
                    decipher_only=False,
                ),
                critical=True,
            )
            # Extended key usage: client auth covers SAML signing purposes.
            .add_extension(
                x509.ExtendedKeyUsage([ExtendedKeyUsageOID.CLIENT_AUTH]),
                critical=False,
            )
            # Subject key identifier — required by many IdP implementations.
            .add_extension(
                x509.SubjectKeyIdentifier.from_public_key(pub_key),
                critical=False,
            )
            .sign(private_key, hashes.SHA256())
        )

        # Serialise private key to PEM, then Fernet-encrypt it.
        private_key_pem: str = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode()

        encrypted_key: str = self._fernet.encrypt(private_key_pem.encode()).decode()
        cert_pem: str = cert.public_bytes(serialization.Encoding.PEM).decode()

        return encrypted_key, cert_pem

    def decrypt_sp_key(self, encrypted_key: str) -> str:
        """Decrypt and return the SP private key, **without PEM headers**.

        python3-saml's ``privateKey`` setting must contain just the raw base64
        bytes, so this method strips the ``-----BEGIN …-----`` lines after
        decrypting.

        Raises:
            ValueError: If decryption fails (wrong key or corrupt ciphertext).
        """
        try:
            decrypted_pem: str = self._fernet.decrypt(encrypted_key.encode()).decode()
        except Exception as exc:
            raise ValueError("SP private key decryption failed") from exc
        return _strip_pem_headers(decrypted_pem)

    @staticmethod
    def get_cert_for_saml(cert_pem: str) -> str:
        """Strip PEM headers from a certificate for use in python3-saml settings."""
        return _strip_pem_headers(cert_pem)
