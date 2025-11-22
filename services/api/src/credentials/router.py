from fastapi import APIRouter, Depends, status

from src.core.dependencies import DatabaseDep, require_password_changed
from src.db.models import User
from src.credentials.schemas import (
    CredentialCreate,
    CredentialResponse,
    CredentialResponseDropDown,
)
from src.credentials.service import CredentialService
from src.core.responses import ApiResponse

router = APIRouter(prefix="/credentials", tags=["credentials"])


def get_credential_service(db: DatabaseDep) -> CredentialService:
    """Dependency to get credential service instance."""
    return CredentialService(session=db)


@router.post(
    "/",
    response_model=ApiResponse[CredentialResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new credential",
    description="""Create a new credential with encrypted data. 
    The credential data will be encrypted before storage.""",
)
async def create_credential(
    credential_data: CredentialCreate,
    current_user: User = Depends(require_password_changed),
    service: CredentialService = Depends(get_credential_service),
) -> ApiResponse[CredentialResponse]:
    """Create a new credential."""
    credential = await service.create_credential(credential_data, current_user)

    return ApiResponse(
        data=CredentialResponse.model_validate(credential),
        message="Credential created successfully",
    )


@router.get(
    "/",
    response_model=ApiResponse[list[CredentialResponse]],
    summary="List all credentials",
    description="""List all credentials in the system.""",
)
async def list_credentials(
    current_user: User = Depends(require_password_changed),
    service: CredentialService = Depends(get_credential_service),
) -> ApiResponse[list[CredentialResponse]]:
    """List all credentials."""
    credentials = await service.list_credentials()

    return ApiResponse(
        data=[CredentialResponse.model_validate(c) for c in credentials],
        message=f"Found {len(credentials)} credential(s)",
    )


@router.get(
    "/dropdown",
    response_model=ApiResponse[list[CredentialResponseDropDown]],
    summary="List all credentials for dropdown",
    description="""List all credentials in the system for dropdowns.""",
)
async def list_credentials_dropdown(
    current_user: User = Depends(require_password_changed),
    service: CredentialService = Depends(get_credential_service),
) -> ApiResponse[list[CredentialResponseDropDown]]:
    """List all credentials for dropdowns."""
    credentials = await service.list_credentials()

    return ApiResponse(
        data=[CredentialResponseDropDown.model_validate(c) for c in credentials],
        message=f"Found {len(credentials)} credential(s)",
    )
