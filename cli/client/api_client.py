"""
API Client

HTTP client with token-based authentication for Rune API.
"""

import requests
from typing import Optional, Dict, Any, List
from urllib.parse import urljoin

from cli.auth.token_manager import get_token_manager
from cli.core.config import get_config


class APIError(Exception):
    """Base exception for API errors."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        response: Optional[Dict] = None
    ):
        self.message = message
        self.status_code = status_code
        self.response = response
        super().__init__(self.message)


class AuthenticationError(APIError):
    """Raised when authentication fails."""
    pass


class NotFoundError(APIError):
    """Raised when resource is not found."""
    pass


class ValidationError(APIError):
    """Raised when request validation fails."""
    pass


class PermissionError(APIError):
    """Raised when permission is denied."""
    pass


class APIClient:
    """
    HTTP client for Rune API with token-based authentication.
    
    Automatically injects JWT tokens into requests and handles
    common error scenarios.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        token: Optional[str] = None,
        timeout: Optional[int] = None,
    ):
        """
        Initialize the API client.
        
        Args:
            base_url: API base URL (default from config)
            token: JWT token (default from token manager)
            timeout: Request timeout in seconds
        """
        config = get_config()
        self.base_url = base_url or config.api_url
        self.timeout = timeout or config.timeout
        self.verify_ssl = config.verify_ssl
        
        self.token_manager = get_token_manager()
        self._token = token
        
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Rune-CLI/2.0.0",
        })

    def _get_headers(self, extra_headers: Optional[Dict] = None) -> Dict[str, str]:
        """Build request headers with authentication."""
        headers = dict(self.session.headers)
        
        # Add authorization token
        token = self._token or self.token_manager.get_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        # Add extra headers
        if extra_headers:
            headers.update(extra_headers)
        
        return headers

    def _extract_error_message(self, data: Dict) -> str:
        """Extract error message from response data."""
        error_msg = data.get("detail", data.get("message", "Unknown error"))
        
        if isinstance(error_msg, list):
            # FastAPI validation errors
            messages = []
            for e in error_msg:
                if isinstance(e, dict):
                    loc = ".".join(str(x) for x in e.get("loc", []))
                    msg = e.get("msg", "")
                    messages.append(f"{loc}: {msg}" if loc else msg)
                else:
                    messages.append(str(e))
            error_msg = "; ".join(messages)
        elif isinstance(error_msg, dict):
            error_msg = str(error_msg)
        
        return error_msg

    def _handle_response(self, response: requests.Response) -> Any:
        """Handle API response and raise appropriate exceptions."""
        try:
            data = response.json() if response.text else {}
        except ValueError:
            data = {"detail": response.text}
        
        # Success responses
        if 200 <= response.status_code < 300:
            # Handle ApiResponse wrapper
            if isinstance(data, dict) and "data" in data:
                return data.get("data")
            return data
        
        # Extract error message
        error_msg = self._extract_error_message(data)
        
        # Handle specific status codes
        if response.status_code == 401:
            raise AuthenticationError(
                error_msg or "Authentication failed. Please login again.",
                status_code=response.status_code,
                response=data
            )
        elif response.status_code == 403:
            raise PermissionError(
                error_msg or "Permission denied",
                status_code=response.status_code,
                response=data
            )
        elif response.status_code == 404:
            raise NotFoundError(
                error_msg or "Resource not found",
                status_code=response.status_code,
                response=data
            )
        elif response.status_code == 422:
            raise ValidationError(
                error_msg or "Validation error",
                status_code=response.status_code,
                response=data
            )
        else:
            raise APIError(
                error_msg or f"API error: {response.status_code}",
                status_code=response.status_code,
                response=data
            )

    def request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        files: Optional[Dict] = None,
    ) -> Any:
        """
        Make an HTTP request to the API.
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE, etc.)
            endpoint: API endpoint path
            data: Request body data
            params: Query parameters
            headers: Additional headers
            files: Files to upload
            
        Returns:
            Parsed response data
        """
        url = urljoin(self.base_url + "/", endpoint.lstrip("/"))
        request_headers = self._get_headers(headers)
        
        # Remove Content-Type for file uploads
        if files:
            request_headers.pop("Content-Type", None)
        
        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data if not files else None,
                data=data if files else None,
                params=params,
                headers=request_headers,
                files=files,
                timeout=self.timeout,
                verify=self.verify_ssl,
            )
            
            return self._handle_response(response)
        
        except requests.exceptions.ConnectionError:
            raise APIError(
                f"Failed to connect to API at {self.base_url}. "
                "Make sure the API server is running."
            )
        except requests.exceptions.Timeout:
            raise APIError(
                f"Request timed out after {self.timeout} seconds"
            )
        except requests.exceptions.RequestException as e:
            raise APIError(f"Request failed: {e}")

    # Convenience methods
    def get(self, endpoint: str, params: Optional[Dict] = None, **kwargs) -> Any:
        """Make a GET request."""
        return self.request("GET", endpoint, params=params, **kwargs)

    def post(self, endpoint: str, data: Optional[Dict] = None, **kwargs) -> Any:
        """Make a POST request."""
        return self.request("POST", endpoint, data=data, **kwargs)

    def put(self, endpoint: str, data: Optional[Dict] = None, **kwargs) -> Any:
        """Make a PUT request."""
        return self.request("PUT", endpoint, data=data, **kwargs)

    def patch(self, endpoint: str, data: Optional[Dict] = None, **kwargs) -> Any:
        """Make a PATCH request."""
        return self.request("PATCH", endpoint, data=data, **kwargs)

    def delete(self, endpoint: str, **kwargs) -> Any:
        """Make a DELETE request."""
        return self.request("DELETE", endpoint, **kwargs)

    # Auth-specific methods
    def login(self, email: str, password: str) -> Dict[str, Any]:
        """
        Login and return token response.
        
        Args:
            email: User email
            password: User password
            
        Returns:
            Token response with access_token and refresh_token
        """
        response = self.post("/api/auth/login", data={
            "email": email,
            "password": password,
        })
        return response

    def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh access token."""
        return self.post("/api/auth/refresh", data={
            "refresh_token": refresh_token,
        })

    def logout(self) -> None:
        """Logout current user."""
        self.post("/api/auth/logout")

    def check_first_time_setup(self) -> Dict[str, Any]:
        """Check if first-time setup is needed."""
        response = self.get("/api/auth/first-time-setup")
        # Handle nested response structure - extract 'requires_setup' properly
        if isinstance(response, dict):
            return {"is_first_time_setup": response.get("requires_setup", False)}
        return {"is_first_time_setup": False}

    def first_admin_signup(
        self,
        name: str,
        email: str,
        password: str,
    ) -> Dict[str, Any]:
        """Create first admin account."""
        return self.post("/api/auth/first-admin-signup", data={
            "name": name,
            "email": email,
            "password": password,
        })

    # Health check
    def health_check(self) -> Dict[str, Any]:
        """Check API health status."""
        try:
            response = self.session.get(
                urljoin(self.base_url + "/", "api/health"),
                timeout=self.timeout,
                verify=self.verify_ssl,
            )
            return response.json() if response.text else {"status": "unknown"}
        except Exception as e:
            return {"status": "error", "error": str(e)}


# Global API client instance
_api_client: Optional[APIClient] = None


def get_api_client() -> APIClient:
    """Get the global API client instance."""
    global _api_client
    if _api_client is None:
        _api_client = APIClient()
    return _api_client


def create_api_client(**kwargs) -> APIClient:
    """Create a new API client instance."""
    return APIClient(**kwargs)


# Export all public functions and classes
__all__ = [
    "APIError",
    "AuthenticationError",
    "NotFoundError",
    "ValidationError",
    "PermissionError",
    "APIClient",
    "get_api_client",
    "create_api_client",
]
