from fastapi import APIRouter, Depends

from src.core.dependencies import DatabaseDep
from src.core.responses import ApiResponse
from src.setup.schemas import (
    FirstAdminSignupRequest,
    FirstAdminSignupResponse,
)
from src.setup.service import SetupService

router = APIRouter(prefix="/setup", tags=["Setup"])


async def get_setup_service(db: DatabaseDep) -> SetupService:
    return SetupService(db=db)


@router.get(
    "/status",
    response_model=ApiResponse[bool],
    summary="Check first-time setup status",
    description="Check if the system requires first-time admin setup. Returns true if no users exist.",
)
async def check_setup_status(
    setup_service: SetupService = Depends(get_setup_service),
) -> ApiResponse[bool]:
    requires_setup = await setup_service.is_first_time_setup()

    if requires_setup:
        message = "First-time setup required. Please create the initial admin account."
    else:
        message = "System already configured. Please use the login page."

    return ApiResponse(
        success=True,
        message=message,
        data=requires_setup,
    )


@router.post(
    "/initialize",
    response_model=ApiResponse[FirstAdminSignupResponse],
    summary="Initialize system with first admin",
    description="Create the first admin account. Only available when no users exist in the system.",
)
async def initialize_first_admin(
    signup_data: FirstAdminSignupRequest,
    setup_service: SetupService = Depends(get_setup_service),
) -> ApiResponse[FirstAdminSignupResponse]:
    # Create the first admin user (includes race condition protection)
    admin_user = await setup_service.create_first_admin(signup_data)

    response_data = FirstAdminSignupResponse(
        user_id=admin_user.id,
        name=admin_user.name,
        email=admin_user.email,
    )

    return ApiResponse(
        success=True,
        message="First admin account created",
        data=response_data,
    )
