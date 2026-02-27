import base64
import json
from typing import Any

from cryptography.fernet import Fernet

from src.core.config import get_settings


class CredentialEncryption:
    """Handle encryption and decryption of credential data."""

    def __init__(self):
        """Initialize encryption with key from settings."""
        settings = get_settings()
        if not settings.encryption_key:
            raise ValueError(
                "ENCRYPTION_KEY must be set in environment variables for credential encryption"
            )

        # Use the encryption key directly (must be a valid Fernet key)
        self._fernet = Fernet(settings.encryption_key.encode())

    def encrypt_credential_data(self, data: dict[str, Any]) -> str:
        """
        Encrypt credential data dictionary.

        Args:
            data: Dictionary containing credential data

        Returns:
            Base64-encoded encrypted string
        """
        json_data = json.dumps(data)
        encrypted = self._fernet.encrypt(json_data.encode())
        return base64.b64encode(encrypted).decode()

    def decrypt_credential_data(self, encrypted_data: str) -> dict[str, Any]:
        """
        Decrypt credential data.

        Args:
            encrypted_data: Base64-encoded encrypted string

        Returns:
            Dictionary containing decrypted credential data
        """
        decoded = base64.b64decode(encrypted_data.encode())
        decrypted = self._fernet.decrypt(decoded)
        return json.loads(decrypted.decode())


def get_encryptor() -> CredentialEncryption:
    """Get credential encryption instance."""
    return CredentialEncryption()
