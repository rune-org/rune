from fastapi import APIRouter, Depends, status
from src.core.dependencies import DatabaseDep, get_current_admin
from src.core.responses import ApiResponse
from src.users.schemas import UserCreate, AdminUserUpdate, UserResponse
from src.users.service import UserService


router = APIRouter(
    prefix="/users",
    tags=["Users"],
    dependencies=[Depends(get_current_admin)],  # All routes require admin by default
)


def get_user_service(db: DatabaseDep) -> UserService:
    return UserService(db=db)


@router.get(
    "/",
    response_model=ApiResponse[list[UserResponse]],
    summary="Get all users",
    description="Retrieve a list of all users in the system",
)
async def get_all_users(
    service: UserService = Depends(get_user_service),
) -> ApiResponse[list[UserResponse]]:
    """
    GET /users
    """
    users = await service.get_all_users()
    return ApiResponse(
        success=True,
        message="Users retrieved successfully",
        data=users,
    )


@router.get(
    "/{user_id}",
    response_model=ApiResponse[UserResponse],
    summary="Admin gets user by ID",
    description="Admin retrieves a single user by their id.",
)
async def get_user_by_id(
    user_id: int,
    service: UserService = Depends(get_user_service),
) -> ApiResponse[UserResponse]:
    """
    GET /users/{user_id}
    Admin-only endpoint.
    """

    user = await service.get_user_by_id(user_id)
    return ApiResponse(
        success=True,
        message="User retrieved successfully",
        data=user,
    )


@router.post(
    "/",
    response_model=ApiResponse[UserResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
    description="Create a new user account. Email must be unique.",
)
async def create_user(
    user_data: UserCreate,
    service: UserService = Depends(get_user_service),
) -> ApiResponse[UserResponse]:
    """
    POST /users
    """
    new_user = await service.create_user(user_data)
    return ApiResponse(
        success=True,
        message="User created successfully",
        data=new_user,
    )


@router.put(
    "/{user_id}",
    response_model=ApiResponse[UserResponse],
    summary="Admin updates user",
    description="Admin can update an existing user's information excluding its password.",
)
async def update_user(
    user_id: int,
    user_data: AdminUserUpdate,
    service: UserService = Depends(get_user_service),
) -> ApiResponse[UserResponse]:
    """
    PUT /users/{user_id}
    Admin-only endpoint.
    """

    updated_user = await service.admin_update_user(user_id, user_data)
    return ApiResponse(
        success=True,
        message="User updated successfully",
        data=updated_user,
    )


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete user",
    description="Permanently delete a user from the system.",
)
async def delete_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
) -> None:
    """
    DELETE /users/{user_id}
    """
    await service.delete_user(user_id)
