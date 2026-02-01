"""
Input Validators

Validation functions for user input.
"""

import re
from typing import Tuple, Optional


def validate_email(email: str) -> Tuple[bool, Optional[str]]:
    """
    Validate email address format.
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not email:
        return False, "Email is required"
    
    # Basic email regex pattern
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    if not re.match(pattern, email):
        return False, "Invalid email format"
    
    return True, None


def validate_url(url: str) -> Tuple[bool, Optional[str]]:
    """
    Validate URL format.
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not url:
        return False, "URL is required"
    
    # Basic URL pattern for http/https
    pattern = r'^https?://[a-zA-Z0-9.-]+(:[0-9]+)?(/.*)?$'
    
    if not re.match(pattern, url):
        return False, "Invalid URL format. Must start with http:// or https://"
    
    return True, None


def validate_password(password: str, min_length: int = 8) -> Tuple[bool, Optional[str]]:
    """
    Validate password strength.
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not password:
        return False, "Password is required"
    
    if len(password) < min_length:
        return False, f"Password must be at least {min_length} characters"
    
    # Check for at least one uppercase, lowercase, and digit
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r'\d', password):
        return False, "Password must contain at least one digit"
    
    return True, None


def validate_name(name: str, min_length: int = 2, max_length: int = 100) -> Tuple[bool, Optional[str]]:
    """
    Validate name field.
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not name:
        return False, "Name is required"
    
    name = name.strip()
    
    if len(name) < min_length:
        return False, f"Name must be at least {min_length} characters"
    
    if len(name) > max_length:
        return False, f"Name must be at most {max_length} characters"
    
    return True, None


def validate_integer(
    value: str,
    min_val: Optional[int] = None,
    max_val: Optional[int] = None,
    field_name: str = "Value",
) -> Tuple[bool, Optional[int], Optional[str]]:
    """
    Validate and parse integer value.
    
    Returns:
        Tuple of (is_valid, parsed_value, error_message)
    """
    try:
        num = int(value)
    except (ValueError, TypeError):
        return False, None, f"{field_name} must be a valid integer"
    
    if min_val is not None and num < min_val:
        return False, None, f"{field_name} must be at least {min_val}"
    
    if max_val is not None and num > max_val:
        return False, None, f"{field_name} must be at most {max_val}"
    
    return True, num, None


def validate_positive_integer(value: str, field_name: str = "Value") -> Tuple[bool, Optional[int], Optional[str]]:
    """Validate positive integer."""
    return validate_integer(value, min_val=1, field_name=field_name)


def validate_workflow_name(name: str) -> Tuple[bool, Optional[str]]:
    """
    Validate workflow name.
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not name:
        return False, "Workflow name is required"
    
    name = name.strip()
    
    if len(name) < 3:
        return False, "Workflow name must be at least 3 characters"
    
    if len(name) > 100:
        return False, "Workflow name must be at most 100 characters"
    
    # Only allow alphanumeric, spaces, underscores, and hyphens
    if not re.match(r'^[\w\s-]+$', name):
        return False, "Workflow name can only contain letters, numbers, spaces, underscores, and hyphens"
    
    return True, None


def validate_docker_container_name(name: str) -> Tuple[bool, Optional[str]]:
    """
    Validate Docker container name.
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not name:
        return False, "Container name is required"
    
    # Docker container name pattern
    pattern = r'^[a-zA-Z0-9][a-zA-Z0-9_.-]*$'
    
    if not re.match(pattern, name):
        return False, "Invalid container name format"
    
    return True, None


# Export all public functions
__all__ = [
    "validate_email",
    "validate_url",
    "validate_password",
    "validate_name",
    "validate_integer",
    "validate_positive_integer",
    "validate_workflow_name",
    "validate_docker_container_name",
]

