from fastapi import APIRouter, Depends, status
from src.core.dependencies import DatabaseDep, CurrentUser
from src.core.responses import ApiResponse
from src.core.exceptions import Forbidden
from src.users.schemas import UserCreate, AdminUserUpdate, ProfileUpdate, UserResponse
from src.users.service import UserService



router = APIRouter(
    prefix="/users",  
    tags=["Users"],
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
    current_user: CurrentUser,
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
    "/me",
    response_model=ApiResponse[UserResponse],
    summary="Get my profile",
    description="Retrieve the user's own profile info.",
)
async def get_my_profile(
    current_user: CurrentUser,
) -> ApiResponse[UserResponse]:
    """
    GET /users/me
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
    PUT /users/me
    """
    updated_user = await service.update_profile(current_user.id, profile_data)
    return ApiResponse(
        success=True,
        message="Profile updated successfully",
        data=updated_user,
    )


@router.get(
    "/{user_id}",
    response_model=ApiResponse[UserResponse],
    summary="Admin gets user by ID",
    description="Admin retrieves a single user by their id.",
)
async def get_user_by_id(
    user_id: int,
    current_user: CurrentUser,
    service: UserService = Depends(get_user_service),
) -> ApiResponse[UserResponse]:
    """
    GET /users/{user_id}
    Admin-only endpoint.
    
    Note: this explicit role checking is just for the mvp but in the future,
    this better be replaced with a dependency for RBAC
    """
    # Simple role check
    if current_user.role != "admin":
        raise Forbidden(detail="Only admins can access this endpoint")
    
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
    current_user: CurrentUser,
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
    current_user: CurrentUser,
    service: UserService = Depends(get_user_service),
) -> ApiResponse[UserResponse]:
    """
    PUT /users/{user_id}
    Admin-only endpoint.
    
    Note: this explicit role checking is just for the mvp but in the future,
    this better be replaced with a dependency for RBAC
    """
    # Simple role check
    if current_user.role != "admin":
        raise Forbidden(detail="Only admins can access this endpoint")
    
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
    current_user: CurrentUser,
    service: UserService = Depends(get_user_service),
) -> None:
    """
    DELETE /users/{user_id}
    """
    await service.delete_user(user_id)