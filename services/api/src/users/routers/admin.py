from fastapi import APIRouter, Depends, status

from src.core.dependencies import RequireAdminRole, require_admin_role
from src.core.responses import ApiResponse
from src.users.dependencies import get_user_service
from src.users.schemas import (
    AdminPasswordResetResponse,
    AdminUserUpdate,
    CreateUserResponse,
    UserCreate,
    UserResponse,
    UserStatusUpdate,
)
from src.users.service import UserService

router = APIRouter(
    prefix="/users",
    tags=["Users"],
    dependencies=[
        Depends(require_admin_role)
    ],  # All routes require admin role and password change
)


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
    response_model=ApiResponse[CreateUserResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
    description="Create a new user account. Email must be unique.",
)
async def create_user(
    user_data: UserCreate,
    service: UserService = Depends(get_user_service),
) -> ApiResponse[CreateUserResponse]:
    """
    POST /users
    Admin creates a new user with auto-generated temporary password.
    """
    new_user, temp_password = await service.create_user(user_data)
    return ApiResponse(
        success=True,
        message="User created successfully with temporary password",
        data=CreateUserResponse(
            user=new_user,
            temporary_password=temp_password,
        ),
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


@router.post(
    "/{user_id}/password",
    response_model=ApiResponse[AdminPasswordResetResponse],
    summary="Admin resets user password",
    description="Admin generates a temporary password for a user. User must change it.",
)
async def reset_user_password(
    user_id: int,
    service: UserService = Depends(get_user_service),
) -> ApiResponse[AdminPasswordResetResponse]:
    """
    POST /users/{user_id}/reset-password
    Admin-only endpoint.
    """
    temp_password = await service.admin_reset_user_password(user_id)
    return ApiResponse(
        success=True,
        message="Temporary password generated successfully",
        data=AdminPasswordResetResponse(
            temporary_password=temp_password,
            user_id=user_id,
        ),
    )


@router.patch(
    "/{user_id}/status",
    response_model=ApiResponse[UserResponse],
    summary="Activate or deactivate a user",
    description="Set a user's active status. Deactivation immediately revokes refresh tokens.",
)
async def set_user_status(
    user_id: int,
    status_data: UserStatusUpdate,
    current_admin: RequireAdminRole,
    service: UserService = Depends(get_user_service),
) -> ApiResponse[UserResponse]:
    """
    PATCH /users/{user_id}/status
    Admin-only endpoint. Revokes refresh tokens immediately on deactivation.
    """
    updated_user = await service.set_user_active_status(
        user_id=user_id,
        is_active=status_data.is_active,
        admin_id=current_admin.id,
    )
    action = "activated" if status_data.is_active else "deactivated"
    return ApiResponse(
        success=True,
        message=f"User {action} successfully",
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
