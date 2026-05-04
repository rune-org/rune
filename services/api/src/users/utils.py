import secrets
import string


def generate_temporary_password(length: int = 8) -> str:
    """
    Generate a secure password that strictly follows validation rules.

    Args:
        length: Length of the password (default: 8, minimum: 8)
    Returns:
        Random password string containing uppercase, lowercase, digits, and special chars
    Example:
        >>> pwd = generate_temporary_password()
        >>> len(pwd)
        8
    """
    if length < 8:
        length = 8  # Enforce minimum length from validation rules

    # 1. Define character sets
    lower = string.ascii_lowercase
    upper = string.ascii_uppercase
    digits = string.digits
    special = '!@#$%^&*(),.?":{}|<>'

    # 2. Guarantee at least one of each required type
    required_chars = [
        secrets.choice(lower),
        secrets.choice(upper),
        secrets.choice(digits),
        secrets.choice(special),
    ]

    # 3. Fill the rest of the length with a mix of everything
    all_chars = lower + upper + digits + special
    password = required_chars + [
        secrets.choice(all_chars) for _ in range(length - len(required_chars))
    ]

    # 4. Shuffle the list so the required characters aren't always at the start
    # Note: secrets.SystemRandom().shuffle is used for cryptographic security
    secrets.SystemRandom().shuffle(password)

    return "".join(password)


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
