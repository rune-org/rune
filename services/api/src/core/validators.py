import re


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password strength according to security requirements.

    Requirements:
    - Minimum length: 8 characters
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one number (0-9)
    - At least one special character (@, #, $, %, !, ?, etc.)

    Returns:
        tuple[bool, str]: (is_valid, error_message)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"

    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter (A-Z)"

    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter (a-z)"

    if not re.search(r"[0-9]", password):
        return False, "Password must contain at least one number (0-9)"

    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return (
            False,
            'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)',
        )

    return True, "Password is strong"
