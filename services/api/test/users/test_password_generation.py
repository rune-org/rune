import pytest

from src.users.utils import generate_temporary_password
from src.core.validators import validate_password_strength


def test_generate_temporary_password_returns_string():
    """Should return a string."""
    password = generate_temporary_password()
    assert isinstance(password, str)


def test_generate_temporary_password_validates_password_strength():
    """Should validate password adheres to validation rules."""
    for _ in range(30):
        password = generate_temporary_password()
        is_valid, error_message = validate_password_strength(password)
        assert is_valid
        assert error_message == "Password is strong"