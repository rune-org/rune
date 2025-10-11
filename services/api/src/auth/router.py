from fastapi import APIRouter, Depends, Response

from src.auth.schemas import LoginRequest, TokenResponse, RefreshRequest
from src.auth.service import AuthService
from src.auth.token_store import TokenStore
from src.core.dependencies import DatabaseDep, RedisDep, get_current_user
from src.core.exceptions import Unauthorized
from src.core.responses import ApiResponse
from src.db.models import User


router = APIRouter(prefix="/auth", tags=["Authentication"])


async def get_token_store(redis: RedisDep) -> TokenStore:
    return TokenStore(redis_client=redis)


async def get_auth_service(
    db: DatabaseDep,
    token_store: TokenStore = Depends(get_token_store),
) -> AuthService:
    return AuthService(db=db, token_store=token_store)


@router.post(
    "/login",
    response_model=ApiResponse[TokenResponse],
    summary="User login",
    description="Authenticate user with email and password. Returns access and refresh tokens, and sets an HTTP-only cookie.",
)
async def login(
    login_request: LoginRequest,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
) -> ApiResponse[TokenResponse]:
    user = await auth_service.authenticate_user(
        email=login_request.email, password=login_request.password
    )

    if not user:
        raise Unauthorized(detail="Invalid credentials")

    token_response = await auth_service.create_auth_response(user)
    auth_service.set_auth_cookie(response, token_response.access_token)

    return ApiResponse(success=True, message="Authenticated", data=token_response)


@router.post(
    "/refresh",
    response_model=ApiResponse[TokenResponse],
    summary="Refresh access token",
    description="Generate a new access token using a valid refresh token. The refresh token remains unchanged.",
)
async def refresh(
    refresh_request: RefreshRequest,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
) -> ApiResponse[TokenResponse]:
    token_response = await auth_service.refresh_tokens(
        refresh_token=refresh_request.refresh_token,
    )

    auth_service.set_auth_cookie(response, token_response.access_token)

    return ApiResponse(success=True, message="Token refreshed", data=token_response)


@router.post(
    "/logout",
    response_model=ApiResponse[None],
    summary="User logout",
    description="Logout the current user by revoking their refresh token and clearing the authentication cookie.",
)
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> ApiResponse[None]:
    assert current_user.id is not None
    await auth_service.logout_user_by_id(user_id=current_user.id)
    auth_service.clear_auth_cookie(response)

    return ApiResponse(success=True, message="Logged out", data=None)
