from fastapi import APIRouter, Depends, Query

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
    user: RequirePasswordChanged,
    q: str | None = Query(None, description="Search by name or email", min_length=1),
    service: UserService = Depends(get_user_service),
) -> ApiResponse[list[UserBasicInfo]]:
    """
    GET /users/directory

    Server-side search for users to share credentials or workflows with.
    Accepts an optional `q` query param to filter by name or email.
    Always returns at most 20 results and excludes the current user.
    Any authenticated user can call this.
    """
    users = await service.search_users(exclude_user_id=user.id, search=q)
    return ApiResponse(
        success=True,
        message="Users retrieved successfully",
        data=[UserBasicInfo.model_validate(u) for u in users],
    )
