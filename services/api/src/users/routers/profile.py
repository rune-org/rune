from fastapi import APIRouter, Depends, Response

from src.auth.token_store import TokenStore
from src.core.config import get_settings
from src.core.dependencies import CurrentUser, RedisDep
from src.core.responses import ApiResponse
from src.users.dependencies import get_user_service
from src.users.schemas import (
    ProfileUpdate,
    UserPasswordChange,
    UserResponse,
)
from src.users.service import UserService

router = APIRouter(
    prefix="/profile",
    tags=["Profile"],
)


async def get_token_store(redis: RedisDep) -> TokenStore:
    return TokenStore(redis_client=redis)


@router.get(
    "/me",
    response_model=ApiResponse[UserResponse],
    summary="Get my profile",
    description="Retrieve the user's own profile info.",
)
async def get_my_profile(
    current_user: CurrentUser,
) -> ApiResponse[UserResponse]:
    """
    GET /profile/me
    """
    return ApiResponse(
        success=True,
        message="Profile retrieved successfully",
        data=current_user,
    )


@router.put(
    "/me",
    response_model=ApiResponse[UserResponse],
    summary="Update my profile",
    description="Update your own profile info.",
)
async def update_my_profile(
    profile_data: ProfileUpdate,
    current_user: CurrentUser,
    service: UserService = Depends(get_user_service),
) -> ApiResponse[UserResponse]:
    """
    PUT /profile/me
    """
    updated_user = await service.update_profile(current_user.id, profile_data)
    return ApiResponse(
        success=True,
        message="Profile updated successfully",
        data=updated_user,
    )


@router.post(
    "/me/password",
    response_model=ApiResponse[UserResponse],
    summary="Change my password",
    description="Change your own password. Requires verification of old password. Revokes the current session — re-login required.",
)
async def change_my_password(
    password_data: UserPasswordChange,
    response: Response,
    current_user: CurrentUser,
    service: UserService = Depends(get_user_service),
    token_store: TokenStore = Depends(get_token_store),
) -> ApiResponse[UserResponse]:
    """
    POST /profile/me/password
    User changes their own password.
    Revokes all refresh tokens and clears the auth cookie, forcing re-login.
    """
    updated_user = await service.user_change_password(
        current_user.id,
        password_data.old_password,
        password_data.new_password,
    )

    # Revoke all refresh tokens so any active session is invalidated
    await token_store.revoke_user_tokens(current_user.id)

    # Clear the access token cookie
    settings = get_settings()
    response.delete_cookie(
        key=settings.cookie_name,
        httponly=True,
        secure=settings.cookie_secure,
    )

    return ApiResponse(
        success=True,
        message="Password changed successfully. Please sign in again.",
        data=updated_user,
    )
