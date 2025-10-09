from fastapi import APIRouter, Depends, status
from src.core.dependencies import DatabaseDep, CurrentUser
from src.core.responses import ApiResponse
from src.users.schemas import UserCreate, UserUpdate, UserResponse
from src.users.service import UserService



router = APIRouter(
    prefix="/users",  
    tags=["Users"],
)


async def get_user_service(db: DatabaseDep) -> UserService:
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
    "/{user_id}",
    response_model=ApiResponse[UserResponse],
    summary="Get user by ID",
    description="Retrieve a single user by their id.",
)
async def get_user_by_id(
    user_id: int,
    current_user: CurrentUser,
    service: UserService = Depends(get_user_service),
) -> ApiResponse[UserResponse]:
    """
    GET /users/{user_id}
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
    summary="Update user",
    description="Update an existing user's information.",
)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: CurrentUser,
    service: UserService = Depends(get_user_service),
) -> ApiResponse[UserResponse]:
    """
    PUT /users/{user_id}
    """
    updated_user = await service.update_user(user_id, user_data)
    return ApiResponse(
        success=True,
        message="User updated successfully",
        data=updated_user,
    )


@router.delete(
    "/{user_id}",
    response_model=ApiResponse[dict],
    summary="Delete user",
    description="Permanently delete a user from the system.",
)
async def delete_user(
    user_id: int,
    current_user: CurrentUser,
    service: UserService = Depends(get_user_service),
) -> ApiResponse[dict]:
    """
    DELETE /users/{user_id}
    """
    await service.delete_user(user_id)
    return ApiResponse(
        success=True,
        message="User deleted successfully",
        data={"deleted": True, "user_id": user_id},
    )
