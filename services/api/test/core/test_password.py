"""Tests for core password hashing utilities."""

import pytest
from src.core.password import hash_password, verify_password


def test_hash_password_returns_string():
    """Should return a string."""
    result = hash_password("SomePassword1!")
    assert isinstance(result, str)


def test_hash_password_is_not_plaintext():
    """Hash should not equal the original password."""
    password = "SomePassword1!"
    assert hash_password(password) != password


def test_hash_password_produces_unique_hashes():
    """Same password should produce different hashes due to random salt."""
    password = "SomePassword1!"
    hash1 = hash_password(password)
    hash2 = hash_password(password)
    assert hash1 != hash2


def test_hash_password_produces_argon2_hash():
    """Hash should be in Argon2 format."""
    result = hash_password("SomePassword1!")
    assert result.startswith("$argon2")


# ============================================================================
# VERIFY_PASSWORD TESTS
# ============================================================================


def test_verify_password_correct_password():
    """Should return True when password matches its hash."""
    password = "SomePassword1!"
    hashed = hash_password(password)
    assert verify_password(password, hashed) is True


def test_verify_password_wrong_password():
    """Should return False when password does not match hash."""
    hashed = hash_password("SomePassword1!")
    assert verify_password("WrongPassword1!", hashed) is False


def test_verify_password_empty_string_against_hash():
    """Should return False when verifying empty string against a real hash."""
    hashed = hash_password("SomePassword1!")
    assert verify_password("", hashed) is False


def test_verify_password_invalid_hash():
    """Should return False when hash is not a valid Argon2 hash."""
    assert verify_password("SomePassword1!", "not-a-valid-hash") is False


def test_verify_password_case_sensitive():
    """Password verification should be case-sensitive."""
    password = "SomePassword1!"
    hashed = hash_password(password)
    assert verify_password("somepassword1!", hashed) is False
