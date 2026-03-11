"""Pure validator functions for SAML-related Pydantic schemas.

These are kept separate so they can be imported by schemas.py without
creating circular dependencies, and to keep the schema module focused on
data shape rather than validation logic.
"""

from typing import Optional
from urllib.parse import urlparse


def validate_idp_url(v: Optional[str], field_label: str) -> Optional[str]:
    """Ensure a URL is absolute (http/https) and within a sane length."""
    if v is None:
        return v
    v = v.strip()
    if len(v) > 2048:
        raise ValueError(f"{field_label} must not exceed 2 048 characters")
    parsed = urlparse(v)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError(f"{field_label} must start with http:// or https://")
    if not parsed.netloc:
        raise ValueError(f"{field_label} is not a valid URL (missing host)")
    return v


def validate_pem_certificate(v: str) -> str:
    """Ensure the value looks like a PEM-encoded X.509 certificate."""
    v = v.strip()
    if not v.startswith("-----BEGIN CERTIFICATE-----"):
        raise ValueError(
            "idp_certificate must be a PEM-encoded X.509 certificate "
            "starting with '-----BEGIN CERTIFICATE-----'"
        )
    if "-----END CERTIFICATE-----" not in v:
        raise ValueError(
            "idp_certificate is missing '-----END CERTIFICATE-----' footer"
        )
    # Rough size guard — a DER-encoded 4096-bit cert is ~2 KB; PEM is ~2.7 KB.
    if len(v) > 8192:
        raise ValueError("idp_certificate is unexpectedly large (> 8 KiB)")
    return v
