from fastapi import HTTPException, status


class Unauthorized(HTTPException):
    """
    HTTP 401 Unauthorized Exception

    Raised when authentication is required but not provided or invalid.
    Use this when the user needs to log in or provide valid credentials.

    Args:
        detail: Custom error message explaining why authentication failed
    """

    def __init__(self, detail: str = "Unauthorized"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


class NotFound(HTTPException):
    """
    HTTP 404 Not Found Exception

    Raised when a requested resource (user, item, etc.) cannot be found.
    This is the most commonly used exception for missing resources.

    Args:
        detail: Custom message describing what resource was not found
    """

    def __init__(self, detail: str = "Not Found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class AlreadyExists(HTTPException):
    """
    HTTP 409 Conflict Exception

    Raised when attempting to create a resource that already exists,
    such as registering with an email that's already in use.

    Args:
        detail: Custom message explaining what resource already exists
    """

    def __init__(self, detail: str = "Already Exists"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class Forbidden(HTTPException):
    """
    HTTP 403 Forbidden Exception

    Raised when the user is authenticated but lacks permission to access
    the requested resource or perform the requested action.

    Args:
        detail: Custom message explaining why access is forbidden
    """

    def __init__(
        self, detail: str = "You don't have permission to access this resource"
    ):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class BadRequest(HTTPException):
    """
    HTTP 400 Bad Request Exception

    Raised when the request contains invalid data, missing required fields,
    or violates business rules that can't be caught by Pydantic validation.

    Args:
        detail: Custom message explaining what's wrong with the request
    """

    def __init__(self, detail: str = "Bad Request"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class InvalidTokenError(HTTPException):
    """
    Invalid Token Exception (HTTP 401)

    Args:
        detail: Custom message explaining why the token is invalid
    """

    def __init__(self, detail: str = "Invalid token"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
        )


class TokenExpiredError(HTTPException):
    """
    Token Expired Exception (HTTP 401)

    Args:
        detail: Custom message explaining the token has expired
    """

    def __init__(self, detail: str = "Token expired"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
        )


class RedisConnectionError(HTTPException):
    """
    Redis Connection Error Exception (HTTP 503)

    Args:
        detail: Custom message explaining the Redis error
    """

    def __init__(self, detail: str = "Redis service unavailable"):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        )
