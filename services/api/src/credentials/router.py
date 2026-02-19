from fastapi import APIRouter, Depends, status

from src.core.dependencies import DatabaseDep, require_password_changed
from src.core.responses import ApiResponse
from src.credentials.permissions import CredentialPermissionService
from src.credentials.schemas import (
    CredentialCreate,
    CredentialResponse,
    CredentialResponseDropDown,
    CredentialShare,
    CredentialShareInfo,
    CredentialUpdate,
)
from src.credentials.service import CredentialService
from src.db.models import User

router = APIRouter(prefix="/credentials", tags=["credentials"])


def get_credential_service(db: DatabaseDep) -> CredentialService:
    """Dependency to get credential service instance."""
    return CredentialService(session=db)


def get_permission_service(db: DatabaseDep) -> CredentialPermissionService:
    """Dependency to get permission service instance."""
    return CredentialPermissionService(db=db)


@router.post(
    "/",
    response_model=ApiResponse[CredentialResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new credential",
)
async def create_credential(
    credential_data: CredentialCreate,
    current_user: User = Depends(require_password_changed),
    service: CredentialService = Depends(get_credential_service),
) -> ApiResponse[CredentialResponse]:
    """
    Create a new credential with encrypted data.

    The credential data will be encrypted before storage and you will
    become the owner of this credential.

    Permissions:
    - OWNER: (you become the owner upon creation)
    - ADMIN: can create credentials
    - USER: can create credentials
    """
    credential = await service.create_credential(credential_data, current_user)
    response = await service.enrich_credential_response(credential, current_user)

    return ApiResponse(
        data=response,
        message="Credential created successfully",
    )


@router.get(
    "/",
    response_model=ApiResponse[list[CredentialResponse]],
    summary="List all accessible credentials",
)
async def list_credentials(
    current_user: User = Depends(require_password_changed),
    service: CredentialService = Depends(get_credential_service),
) -> ApiResponse[list[CredentialResponse]]:
    """
    List all credentials you have access to.

    Admins see all credentials in the system. Regular users see credentials
    they own or that have been shared with them. Each credential includes
    permission flags indicating what actions you can perform.

    Permissions:
    - OWNER: can view own credentials
    - ADMIN: can view all credentials
    - SHARED USER: can view shared credentials
    """
    credentials = await service.list_credentials(current_user)

    # Enrich each credential with permission flags
    enriched = []
    for cred in credentials:
        enriched.append(await service.enrich_credential_response(cred, current_user))

    return ApiResponse(
        data=enriched,
        message=f"Found {len(enriched)} credential(s)",
    )


@router.get(
    "/dropdown",
    response_model=ApiResponse[list[CredentialResponseDropDown]],
    summary="List credentials for dropdown selection",
)
async def list_credentials_dropdown(
    current_user: User = Depends(require_password_changed),
    service: CredentialService = Depends(get_credential_service),
) -> ApiResponse[list[CredentialResponseDropDown]]:
    """
    List all accessible credentials in simplified format for dropdowns.

    Admins see all credentials. Regular users see credentials they own
    or that are shared with them.

    Permissions:
    - OWNER: can view own credentials
    - ADMIN: can view all credentials
    - SHARED USER: can view shared credentials
    """
    credentials = await service.list_credentials(current_user)

    return ApiResponse(
        data=[CredentialResponseDropDown.model_validate(c) for c in credentials],
        message=f"Found {len(credentials)} credential(s)",
    )


@router.get(
    "/{credential_id}",
    response_model=ApiResponse[CredentialResponse],
    summary="Get a specific credential",
)
async def get_credential(
    credential_id: int,
    current_user: User = Depends(require_password_changed),
    service: CredentialService = Depends(get_credential_service),
) -> ApiResponse[CredentialResponse]:
    """
    Get details of a specific credential.

    You must be the owner, have the credential shared with you, or be
    an admin to access this credential.

    Permissions:
    - OWNER: can view own credential
    - ADMIN: can view any credential
    - SHARED USER: can view shared credential
    """
    credential = await service.get_credential(credential_id, current_user)
    response = await service.enrich_credential_response(credential, current_user)

    return ApiResponse(
        data=response,
        message="Credential retrieved successfully",
    )


@router.patch(
    "/{credential_id}",
    response_model=ApiResponse[CredentialResponse],
    summary="Update a credential",
)
async def update_credential(
    credential_id: int,
    credential_data: CredentialUpdate,
    current_user: User = Depends(require_password_changed),
    service: CredentialService = Depends(get_credential_service),
) -> ApiResponse[CredentialResponse]:
    """
    Partially update a credential.

    You only need to send the fields you want to update (name, credential_type,
    or credential_data). Fields not included in the request will remain unchanged.

    Only the credential owner and admins can edit credentials. Shared
    users cannot edit credentials even if they have access.

    Permissions:
    - OWNER: can update own credential
    - ADMIN: can update any credential
    - SHARED USER: cannot update
    """
    credential = await service.update_credential(
        credential_id, credential_data, current_user
    )
    response = await service.enrich_credential_response(credential, current_user)

    return ApiResponse(
        data=response,
        message="Credential updated successfully",
    )


@router.delete(
    "/{credential_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a credential",
)
async def delete_credential(
    credential_id: int,
    current_user: User = Depends(require_password_changed),
    service: CredentialService = Depends(get_credential_service),
) -> None:
    """
    Delete a credential.

    Only the credential owner and admins can delete credentials. This
    will also remove all shares of this credential.

    Permissions:
    - OWNER: can delete own credential
    - ADMIN: can delete any credential
    - SHARED USER: cannot delete
    """
    await service.delete_credential(credential_id, current_user)


@router.post(
    "/{credential_id}/share",
    response_model=ApiResponse[CredentialShareInfo],
    status_code=status.HTTP_201_CREATED,
    summary="Share a credential with another user",
)
async def share_credential(
    credential_id: int,
    share_data: CredentialShare,
    current_user: User = Depends(require_password_changed),
    service: CredentialService = Depends(get_credential_service),
    permission_service: CredentialPermissionService = Depends(get_permission_service),
) -> ApiResponse[CredentialShareInfo]:
    """
    Share a credential with another user.

    Only the credential owner can share credentials. Admins cannot share
    credentials they don't own. The shared user will be able to view and
    use the credential in workflows.

    Permissions:
    - OWNER: can share own credential
    - ADMIN: cannot share others' credentials
    - SHARED USER: cannot share
    """
    credential = await service.get_credential(credential_id, current_user)

    await permission_service.share_credential(
        credential, share_data.user_id, current_user
    )

    # Get user info for response
    shares = await permission_service.list_credential_shares(credential_id)
    share_info = next((s for s in shares if s.user_id == share_data.user_id), None)
    if share_info is None:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=500,
            detail="Shared credential not found after creation. Please try again.",
        )

    return ApiResponse(
        data=share_info,
        message="Credential shared successfully",
    )


@router.delete(
    "/{credential_id}/share/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke credential access from a user",
)
async def revoke_credential_access(
    credential_id: int,
    user_id: int,
    current_user: User = Depends(require_password_changed),
    service: CredentialService = Depends(get_credential_service),
    permission_service: CredentialPermissionService = Depends(get_permission_service),
) -> None:
    """
    Revoke a user's access to a credential.

    The credential owner can revoke access from any user. Admins can also
    revoke access for oversight purposes. Shared users can only revoke their
    own access.

    Permissions:
    - OWNER: can revoke access from any user
    - ADMIN: can revoke access from any user (oversight)
    - SHARED USER: can only revoke their own access (user_id must be their own)
    """
    credential = await service.get_credential(credential_id, current_user)

    await permission_service.revoke_credential_access(credential, user_id, current_user)


@router.get(
    "/{credential_id}/shares",
    response_model=ApiResponse[list[CredentialShareInfo]],
    summary="List users who have access to a credential",
)
async def list_credential_shares(
    credential_id: int,
    current_user: User = Depends(require_password_changed),
    service: CredentialService = Depends(get_credential_service),
    permission_service: CredentialPermissionService = Depends(get_permission_service),
) -> ApiResponse[list[CredentialShareInfo]]:
    """
    List all users who have been granted access to this credential.

    The credential owner can view shares. Admins can also view shares
    for oversight purposes but cannot create new shares.

    Permissions:
    - OWNER: can view shares
    - ADMIN: can view shares (oversight)
    - SHARED USER: cannot view shares
    """
    credential = await service.get_credential(credential_id, current_user)

    # Owner or admin can view shares
    await permission_service.require_view_shares_access(credential, current_user)

    shares = await permission_service.list_credential_shares(credential_id)

    return ApiResponse(
        data=shares,
        message=f"Found {len(shares)} share(s)",
    )


@router.get(
    "/{credential_id}/my-share",
    response_model=ApiResponse[CredentialShareInfo],
    summary="Get your own share info for a credential",
)
async def get_my_share_info(
    credential_id: int,
    current_user: User = Depends(require_password_changed),
    service: CredentialService = Depends(get_credential_service),
    permission_service: CredentialPermissionService = Depends(get_permission_service),
) -> ApiResponse[CredentialShareInfo]:
    """
    Get your own share info for a credential that has been shared with you.

    This endpoint allows shared users to see when the credential was shared
    with them and who shared it.
    """
    # Verify user has access to the credential
    await service.get_credential(credential_id, current_user)

    # Get the user's share info
    share_info = await permission_service.get_user_share_info_full(
        credential_id, current_user.id
    )

    if not share_info:
        from src.core.exceptions import NotFound

        raise NotFound(detail="You are not a shared user of this credential")

    return ApiResponse(
        data=share_info,
        message="Share info retrieved successfully",
    )
