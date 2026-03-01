"""
Client Package

API client for Rune backend communication.

Architecture:
    CLI --HTTP--> API Server (services/api:8000) ---> Database
    
    The API server must be running for most CLI commands to work.
"""

from rune_cli.client.api_client import (
    APIError,
    ConnectionError,
    AuthenticationError,
    NotFoundError,
    ValidationError,
    PermissionError,
    APIClient,
    get_api_client,
    create_api_client,
)

__all__ = [
    "APIError",
    "ConnectionError",
    "AuthenticationError",
    "NotFoundError",
    "ValidationError",
    "PermissionError",
    "APIClient",
    "get_api_client",
    "create_api_client",
]

