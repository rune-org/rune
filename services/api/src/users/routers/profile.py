from fastapi import APIRouter, Depends
from src.core.dependencies import CurrentUser, DatabaseDep
from src.users.service import UserService
from src.core.responses import ApiResponse
from src.users.schemas import ProfileUpdate, UserResponse

router = APIRouter(
    prefix="/profile",
    tags=["Profile"],
)


def get_user_service(db: DatabaseDep) -> UserService:
    return UserService(db=db)


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
