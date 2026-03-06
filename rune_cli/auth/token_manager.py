"""
Token Manager

Manages JWT token storage, retrieval, and validation.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any
import base64

from rune_cli.core.config import get_credentials_path, ensure_config_dir


class TokenError(Exception):
    """Token operation error."""
    pass


class TokenManager:
    """Manages authentication tokens."""
    
    def __init__(self):
        """Initialize token manager."""
        self.credentials_path = get_credentials_path()
    
    def _load_credentials(self) -> Dict[str, Any]:
        """Load credentials from file."""
        if self.credentials_path.exists():
            try:
                return json.loads(self.credentials_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, IOError):
                pass
        return {}
    
    def _save_credentials(self, credentials: Dict[str, Any]) -> None:
        """Save credentials to file."""
        ensure_config_dir()
        self.credentials_path.write_text(
            json.dumps(credentials, indent=2, default=str),
            encoding="utf-8"
        )
        # Set restrictive permissions on Unix
        try:
            os.chmod(self.credentials_path, 0o600)
        except (OSError, AttributeError):
            pass
    
    def save_token(
        self,
        access_token: str,
        email: str,
        refresh_token: Optional[str] = None,
    ) -> None:
        """Save authentication token."""
        credentials = {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "email": email,
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }
        self._save_credentials(credentials)
    
    def get_token(self) -> Optional[str]:
        """Get the stored access token."""
        credentials = self._load_credentials()
        return credentials.get("access_token")
    
    def get_refresh_token(self) -> Optional[str]:
        """Get the stored refresh token."""
        credentials = self._load_credentials()
        return credentials.get("refresh_token")
    
    def get_email(self) -> Optional[str]:
        """Get the stored email."""
        credentials = self._load_credentials()
        return credentials.get("email")
    
    def get_credentials(self) -> Dict[str, Any]:
        """Get all stored credentials."""
        return self._load_credentials()
    
    def clear_token(self) -> None:
        """Clear stored token."""
        if self.credentials_path.exists():
            self.credentials_path.unlink()
    
    def is_authenticated(self) -> bool:
        """Check if user has a stored token."""
        token = self.get_token()
        return token is not None and len(token) > 0
    
    def decode_token(self, token: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Decode JWT token payload (without verification).
        
        Note: This only decodes the payload, it does NOT verify the signature.
        Use this for displaying token info, not for authentication.
        """
        token = token or self.get_token()
        if not token:
            return None
        
        try:
            # JWT format: header.payload.signature
            parts = token.split('.')
            if len(parts) != 3:
                return None
            
            # Decode payload (second part)
            payload = parts[1]
            
            # Add padding if needed
            padding = 4 - len(payload) % 4
            if padding != 4:
                payload += '=' * padding
            
            decoded = base64.urlsafe_b64decode(payload)
            return json.loads(decoded)
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            return None
    
    def get_token_info(self) -> Dict[str, Any]:
        """Get information about the stored token."""
        credentials = self._load_credentials()
        token = credentials.get("access_token")
        
        info = {
            "authenticated": False,
            "email": credentials.get("email"),
            "saved_at": credentials.get("saved_at"),
            "expires_at": None,
            "is_expired": None,
            "user_id": None,
            "role": None,
        }
        
        if not token:
            return info
        
        info["authenticated"] = True
        
        # Decode token for additional info
        payload = self.decode_token(token)
        if payload:
            # Extract expiration
            exp = payload.get("exp")
            if exp:
                exp_dt = datetime.fromtimestamp(exp, tz=timezone.utc)
                info["expires_at"] = exp_dt.isoformat()
                info["is_expired"] = datetime.now(timezone.utc) > exp_dt
            
            # Extract user info
            info["user_id"] = payload.get("sub") or payload.get("user_id")
            info["role"] = payload.get("role")
        
        return info
    
    def is_token_expired(self) -> bool:
        """Check if the token is expired."""
        info = self.get_token_info()
        is_expired = info.get("is_expired")
        
        # If we can't determine expiration, assume not expired
        if is_expired is None:
            return False
        
        return is_expired


# Global token manager instance
_token_manager: Optional[TokenManager] = None


def get_token_manager() -> TokenManager:
    """Get the global token manager instance."""
    global _token_manager
    if _token_manager is None:
        _token_manager = TokenManager()
    return _token_manager


# Export all public functions and classes
__all__ = [
    "TokenError",
    "TokenManager",
    "get_token_manager",
]

