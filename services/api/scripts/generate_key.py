"""Generate encryption key for credential management."""

from cryptography.fernet import Fernet


def generate_encryption_key() -> str:
    """
    Generate a secure Fernet encryption key.

    Returns:
        A 44-character base64-url-encoded string (32 bytes) suitable for Fernet encryption
    """
    return Fernet.generate_key().decode()


if __name__ == "__main__":
    key = generate_encryption_key()
    print("=" * 60)
    print("Generated Fernet Encryption Key for Credential Management")
    print("=" * 60)
    print("Add this to your .env file:")
    print(f"  ENCRYPTION_KEY={key}")
    print()
    print("⚠️  IMPORTANT: Keep this key secure and never commit it to version control!")
    print(
        "⚠️  If you lose this key, you will not be able to decrypt existing credentials!"
    )
    print("=" * 60)
