"""Tests for user utility functions."""

import pytest
import string
from src.users.utils import generate_temporary_password, normalize_email


# ============================================================================
# GENERATE_TEMPORARY_PASSWORD TESTS
# ============================================================================


def test_generate_temporary_password_default_length():
    """Should generate password with default length of 8 characters."""
    password = generate_temporary_password()
    assert len(password) == 8


def test_generate_temporary_password_custom_length():
    """Should generate password with custom length."""
    password = generate_temporary_password(length=12)
    assert len(password) == 12


def test_generate_temporary_password_is_random():
    """Each call should generate a different password."""
    passwords = [generate_temporary_password() for _ in range(100)]
    unique_passwords = set(passwords)
    assert len(unique_passwords) > 95  # Allow for tiny collision chance


def test_generate_temporary_password_returns_string():
    """Should return a string type."""
    password = generate_temporary_password()
    assert isinstance(password, str)


def test_generate_temporary_password_uses_valid_characters():
    """Should only use characters from the defined alphabet."""
    alphabet = string.ascii_letters + string.digits + string.punctuation
    password = generate_temporary_password(length=50)
    assert all(c in alphabet for c in password)


# ============================================================================
# NORMALIZE_EMAIL TESTS
# ============================================================================


def test_normalize_email_converts_to_lowercase():
    """Should convert email to lowercase."""
    assert normalize_email("USER@EXAMPLE.COM") == "user@example.com"
    assert normalize_email("User@Example.Com") == "user@example.com"
    assert normalize_email("ADMIN@TEST.ORG") == "admin@test.org"


def test_normalize_email_strips_whitespace():
    """Should strip leading and trailing whitespace."""
    assert normalize_email("  user@example.com  ") == "user@example.com"
    assert normalize_email("\nuser@example.com\n") == "user@example.com"
    assert normalize_email("\tuser@example.com\t") == "user@example.com"


def test_normalize_email_handles_mixed_case_and_spaces():
    """Should handle both case conversion and whitespace stripping."""
    assert normalize_email("  USER@EXAMPLE.COM  ") == "user@example.com"
    assert normalize_email(" Admin@Test.Org ") == "admin@test.org"


def test_normalize_email_idempotent():
    """Should be idempotent - normalizing twice gives same result."""
    email = "User@Example.Com"
    normalized_once = normalize_email(email)
    normalized_twice = normalize_email(normalized_once)
    assert normalized_once == normalized_twice


def test_normalize_email_handles_already_normalized():
    """Should handle already normalized emails correctly."""
    email = "user@example.com"
    assert normalize_email(email) == email


def test_normalize_email_returns_string():
    """Should return a string type."""
    result = normalize_email("test@example.com")
    assert isinstance(result, str)


def test_normalize_email_preserves_structure():
    """Should not modify email structure, only case and whitespace."""
    assert normalize_email("user+tag@example.com") == "user+tag@example.com"
    assert normalize_email("user.name@sub.example.com") == "user.name@sub.example.com"
    assert (
        normalize_email("user_name@example-domain.co.uk")
        == "user_name@example-domain.co.uk"
    )


def test_normalize_email_empty_string():
    """Should handle empty string."""
    assert normalize_email("") == ""


def test_normalize_email_with_unicode():
    """Should handle unicode characters in email."""
    # Some email providers support unicode
    email = "用户@EXAMPLE.COM"
    result = normalize_email(email)
    assert result == "用户@example.com"
