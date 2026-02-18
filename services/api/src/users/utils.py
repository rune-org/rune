import secrets
import string


def generate_temporary_password(length: int = 8) -> str:
    """
    Generate a cryptographically secure random temporary password.

    Args:
        length: Length of the password (default: 8)

    Returns:
        Random password string containing uppercase, lowercase, digits, and special chars

    Example:
        >>> pwd = generate_temporary_password()
        >>> len(pwd)
        8
    """
    alphabet = string.ascii_letters + string.digits + string.punctuation
    return "".join(secrets.choice(alphabet) for _ in range(length))


def normalize_email(email: str) -> str:
    """
    Normalize email to lowercase for case-insensitive storage.

    Args:
        email: Email address to normalize

    Returns:
        Lowercase email address

    Example:
        >>> normalize_email("USER@EXAMPLE.COM")
        'user@example.com'
    """
    return email.lower().strip()
