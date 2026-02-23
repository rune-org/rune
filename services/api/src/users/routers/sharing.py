from fastapi import APIRouter, Depends

from src.core.dependencies import RequirePasswordChanged
from src.core.responses import ApiResponse
from src.users.dependencies import get_user_service
from src.users.schemas import UserBasicInfo
from src.users.service import UserService

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


@router.get(
    "/directory",
    response_model=ApiResponse[list[UserBasicInfo]],
    summary="List users in directory",
    description="Retrieve minimal information for all users. This endpoint backs the sharing UI by providing a directory of users.",
)
async def list_users_for_sharing(
    _: RequirePasswordChanged,
    service: UserService = Depends(get_user_service),
) -> ApiResponse[list[UserBasicInfo]]:
    """
    GET /users/directory

    Returns a directory of users with minimal info. Used by the frontend when selecting
    users to share credentials or workflows. Any authenticated user can call this.
    """
    users = await service.get_all_users()
    return ApiResponse(
        success=True,
        message="Users retrieved successfully",
        data=[UserBasicInfo.model_validate(u) for u in users],
    )
