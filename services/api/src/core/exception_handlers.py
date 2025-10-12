"""
Custom exception handlers to format errors consistently with ApiResponse.
"""

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Handle HTTPException and format response to match ApiResponse structure.

    This overrides FastAPI's default behavior of returning:
    {"detail": "error message"}

    And instead returns:
    {"success": false, "message": "error message", "data": null}
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.detail,
            "data": None,
        },
    )


def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle request validation errors (422) and format to match ApiResponse structure.

    Formats Pydantic validation errors into a readable message.
    """
    # Extract validation error details
    errors = exc.errors()
    error_messages = []

    for error in errors:
        loc = " -> ".join(str(x) for x in error["loc"][1:])  # Skip 'body'
        msg = error["msg"]
        error_messages.append(f"{loc}: {msg}" if loc else msg)

    message = "; ".join(error_messages) if error_messages else "Validation error"

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": message,
            "data": {"errors": errors},
        },
    )
