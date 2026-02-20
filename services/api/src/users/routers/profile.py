from fastapi import APIRouter, Depends, Response

from src.auth.service import AuthService
from src.auth.token_store import TokenStore
from src.core.dependencies import CurrentUser, DatabaseDep, RedisDep
from src.core.responses import ApiResponse
from src.core.token import create_access_token
from src.users.schemas import (
    ProfileUpdate,
    UserPasswordChange,
    UserPasswordChangeResponse,
    UserResponse,
)
from src.users.service import UserService

router = APIRouter(
    prefix="/profile",
    tags=["Profile"],
)


def get_user_service(db: DatabaseDep) -> UserService:
    return UserService(db=db)


async def get_token_store(redis: RedisDep) -> TokenStore:
    return TokenStore(redis_client=redis)


async def get_auth_service(
    db: DatabaseDep,
    token_store: TokenStore = Depends(get_token_store),
) -> AuthService:
    return AuthService(db=db, token_store=token_store)


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
    "/me/change-password",
    response_model=ApiResponse[UserPasswordChangeResponse],
    summary="Change my password",
    description="Change your own password. Requires verification of old password. Returns a new access token.",
)
async def change_my_password(
    password_data: UserPasswordChange,
    response: Response,
    current_user: CurrentUser,
    db: DatabaseDep,
    service: UserService = Depends(get_user_service),
    auth_service: AuthService = Depends(get_auth_service),
) -> ApiResponse[UserPasswordChangeResponse]:
    """
    POST /profile/me/change-password
    User changes their own password.
    Issues a new access token with updated must_change_password flag.
    """
    updated_user = await service.user_change_password(
        current_user.id,
        password_data.old_password,
        password_data.new_password,
    )

    # Generate new access token with updated must_change_password flag
    new_token = await create_access_token(updated_user, db)

    # Update the access_token cookie using auth service
    auth_service.set_auth_cookie(response, new_token)

    return ApiResponse(
        success=True,
        message="Password changed successfully",
        data=UserPasswordChangeResponse(
            user=updated_user,
            access_token=new_token,
        ),
    )
