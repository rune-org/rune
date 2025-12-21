from fastapi import APIRouter, Depends
from src.core.dependencies import DatabaseDep, RequirePasswordChanged
from src.core.responses import ApiResponse
from src.users.schemas import UserBasicInfo
from src.users.service import UserService


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


def get_user_service(db: DatabaseDep) -> UserService:
    return UserService(db=db)


@router.get(
    "/sharing",
    response_model=ApiResponse[list[UserBasicInfo]],
    summary="List users for sharing",
    description="Get a list of users available for sharing credentials/workflows. "
    "Returns minimal user info and excludes the current user.",
)
async def list_users_for_sharing(
    current_user: RequirePasswordChanged,
    service: UserService = Depends(get_user_service),
) -> ApiResponse[list[UserBasicInfo]]:
    """
    GET /users/sharing

    Returns a list of active users that can be shared with.
    Any authenticated user can call this.
    """
    users = await service.get_users_for_sharing(current_user.id)
    return ApiResponse(
        success=True,
        message="Users retrieved successfully",
        data=[UserBasicInfo.model_validate(u) for u in users],
    )
