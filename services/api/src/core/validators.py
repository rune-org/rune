import regex

# Matches emoji / pictographs and regional-indicator symbols (e.g. flag pairs).
# Aligns with apps/web `userDisplayNameField` (Zod).
_NAME_EMOJI_OR_REGIONAL_INDICATOR = regex.compile(
    r"\p{Extended_Pictographic}|\p{Regional_Indicator}",
)


def validate_user_display_name(name: str) -> str:
    """
    Trim, enforce length (3–40), and reject emoji / regional-indicator symbols.

    Intended for Pydantic ``BeforeValidator``: on failure raises ``ValueError``;
    on success returns the normalized string.

    Returns:
        str: The validated name

    Raises:
        ValueError: If name is too short, too long, or contains emoji or regional-indicator symbols
    """
    name = name.strip()

    valid, error_message = _validate_string_length(name, 3, 40, field_name="name")
    if not valid:
        raise ValueError(error_message)

    valid, error_message = _validate_string_contains_emoji_or_regional_indicator(name, field_name="name")
    if not valid:
        raise ValueError(error_message)

    return name


def validate_password(password: str) -> str:
    """
    Validate password strength according to security requirements.
    Validate the absence of emoji or regional-indicator symbols.

    Intended for Pydantic ``BeforeValidator``: on failure raises ``ValueError``;
    on success returns the normalized string.

    Returns:
        str: The validated password

    Raises:
        ValueError: If password is too short, does not contain uppercase, lowercase, number, or special character
        ValueError: If password contains emoji or regional-indicator symbols
    """
    valid, error_message = _validate_password_strength(password)
    if not valid:
        raise ValueError(error_message)

    valid, error_message = _validate_string_contains_emoji_or_regional_indicator(password, field_name="password")
    if not valid:
        raise ValueError(error_message)

    return password


def validate_email(email: str) -> str:
    """
    Trim, normalize to lowercase, and reject emoji or regional-indicator symbols.

    Intended for Pydantic ``BeforeValidator``: on failure raises ``ValueError``;
    on success returns the normalized string.

    Returns:
        str: The validated email

    Raises:
        ValueError: If email contains emoji or regional-indicator symbols
    """
    email = email.strip().lower()

    valid, error_message = _validate_string_contains_emoji_or_regional_indicator(email, field_name="email")
    if not valid:
        raise ValueError(error_message)

    return email


def _validate_password_strength(password: str) -> tuple[bool, str]:
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

    if not regex.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter (A-Z)"

    if not regex.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter (a-z)"

    if not regex.search(r"[0-9]", password):
        return False, "Password must contain at least one number (0-9)"

    if not regex.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return (
            False,
            'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)',
        )

    return True, "Password is strong"


def _validate_string_length(value: str, min_length: int, max_length: int, *, field_name: str = "string") -> tuple[bool, str]:
    """
    Validate string length.

    Returns:
        tuple[bool, str]: (is_valid, error_message)
    """
    if len(value) < min_length:
        return False, f"{field_name} must be at least {min_length} characters long"
    if len(value) > max_length:
        return False, f"{field_name} must be at most {max_length} characters long"
    return True, f"{field_name} is valid"


def _validate_string_contains_emoji_or_regional_indicator(value: str, *, field_name: str = "string") -> tuple[bool, str]:
    """
    Reject strings containing emoji or regional-indicator symbols.

    Returns:
        tuple[bool, str]: (is_valid, error_message)
    """
    if _NAME_EMOJI_OR_REGIONAL_INDICATOR.search(value):
        msg = f"{field_name} cannot contain emoji or regional-indicator symbols"
        return False, msg
    return True, f"{field_name} is valid"
