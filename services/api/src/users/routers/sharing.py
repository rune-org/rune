from fastapi import APIRouter, Depends, Query
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
    summary="Search users for sharing",
    description="Search for users available for sharing credentials/workflows. "
    "Returns minimal user info, excludes the current user. "
    "Use the 'search' parameter to filter by name or email.",
)
async def list_users_for_sharing(
    current_user: RequirePasswordChanged,
    search: str | None = Query(
        None, description="Search term to filter by name or email"
    ),
    limit: int = Query(
        10, ge=1, le=50, description="Maximum number of results to return"
    ),
    service: UserService = Depends(get_user_service),
) -> ApiResponse[list[UserBasicInfo]]:
    """
    GET /users/sharing

    Returns a list of active users that can be shared with.
    Supports optional search filtering by name or email.
    Any authenticated user can call this.
    """
    users = await service.search_users_for_sharing(
        exclude_user_id=current_user.id,
        search=search,
        limit=limit,
    )
    return ApiResponse(
        success=True,
        message="Users retrieved successfully",
        data=[UserBasicInfo.model_validate(u) for u in users],
    )
