from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.core.responses import ApiResponse


def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Handle HTTPException and format response to match ApiResponse structure.

    This overrides FastAPI's default behavior of returning:
    {"detail": "error message"}

    And instead returns:
    {"success": false, "message": "error message", "data": null}
    """
    api_response = ApiResponse(success=False, message=exc.detail, data=None)
    return JSONResponse(
        status_code=exc.status_code,
        content=api_response.model_dump(),
    )


def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle request validation errors (422) and format to match ApiResponse structure.

    Formats Pydantic validation errors into a readable message.
    """
    # Extract validation error details
    error_messages: list[str] = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error.get("loc", [])[1:])
        message = error.get("msg", "Validation error")
        error_messages.append(f"{field}: {message}")

    api_response = ApiResponse(
        success=False, message="Validation Error(s)", data=error_messages
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content=api_response.model_dump(),
    )


def generic_exception_handler(request: Request, exc: Exception):
    """
    Handle uncaught exceptions and return a generic error response.

    This prevents leaking internal error details to clients.
    """
    api_response = ApiResponse(
        success=False,
        message="An internal server error occurred.",
        data=None,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=api_response.model_dump(),
    )
