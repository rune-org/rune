from fastapi import APIRouter, Depends, status

from src.core.dependencies import DatabaseDep, get_current_user
from src.core.responses import ApiResponse
from src.db.models import User, Workflow
from src.permissions.schemas import (
    WorkflowPermissionListResponse,
    WorkflowRoleUpdateRequest,
    WorkflowShareRequest,
    WorkflowShareResponse,
)
from src.permissions.service import PermissionService
from src.workflow.dependencies import get_workflow_with_permission
from src.workflow.permissions import require_workflow_permission

router = APIRouter(prefix="/workflows", tags=["Workflow Permissions"])


def get_permission_service(db: DatabaseDep) -> PermissionService:
    """Dependency to get permission service instance."""
    return PermissionService(db=db)


@router.post(
    "/{workflow_id}/share",
    response_model=ApiResponse[WorkflowShareResponse],
    summary="Share workflow with another user",
)
@require_workflow_permission("share")
async def share_workflow(
    share_request: WorkflowShareRequest,
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: PermissionService = Depends(get_permission_service),
    current_user: User = Depends(get_current_user),
) -> ApiResponse[WorkflowShareResponse]:
    """
    Share workflow with another user.

    Only the workflow owner may share access with other users. The
    granted role must be EDITOR or VIEWER - OWNER cannot be granted through
    the share endpoint.

    Requires: SHARE permission (owner or admin)

    Permissions:
    - OWNER: can share workflows
    - EDITOR: cannot share workflows
    - VIEWER: cannot share workflows
    - ADMIN: can share workflows (bypass)
    """
    await service.share_workflow(
        workflow=workflow,
        target_user_id=share_request.user_id,
        role=share_request.role,
        granted_by=current_user.id,
    )

    response = WorkflowShareResponse(
        status="success",
        message=f"Workflow shared successfully with role {share_request.role.value}",
    )
    return ApiResponse(success=True, message="Workflow shared", data=response)


@router.delete(
    "/{workflow_id}/share/{user_id}",
    status_code=status.HTTP_200_OK,
    response_model=ApiResponse[WorkflowShareResponse],
    summary="Revoke user's access to workflow",
)
@require_workflow_permission("share")
async def revoke_access(
    user_id: int,
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: PermissionService = Depends(get_permission_service),
) -> ApiResponse[WorkflowShareResponse]:
    """
    Revoke user's access to workflow.

    Only the workflow owner may revoke a user's access; revoking the
    owner's own access is not allowed.

    Requires: SHARE permission (owner or admin)

    Permissions:
    - OWNER: can revoke access
    - EDITOR: cannot revoke access
    - VIEWER: cannot revoke access
    - ADMIN: can revoke access (bypass)
    """
    await service.revoke_workflow_access(workflow=workflow, user_id=user_id)

    response = WorkflowShareResponse(
        status="success", message="Access revoked successfully"
    )
    return ApiResponse(success=True, message="Access revoked", data=response)


@router.get(
    "/{workflow_id}/permissions",
    response_model=ApiResponse[WorkflowPermissionListResponse],
    summary="List all users with access to workflow",
)
@require_workflow_permission("view")
async def list_workflow_permissions(
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: PermissionService = Depends(get_permission_service),
) -> ApiResponse[WorkflowPermissionListResponse]:
    """
    List all users who have access to this workflow.

    Any user with access (owner, editor, or viewer) can list who has
    access to the workflow.

    Requires: VIEW permission (owner/editor/viewer or admin)

    Permissions:
    - OWNER: can view permissions
    - EDITOR: can view permissions
    - VIEWER: can view permissions
    - ADMIN: can view permissions (bypass)
    """
    permissions = await service.list_workflow_permissions(workflow.id)

    response = WorkflowPermissionListResponse(
        workflow_id=workflow.id,
        permissions=permissions,
    )
    return ApiResponse(
        success=True, message="Workflow permissions retrieved", data=response
    )


@router.patch(
    "/{workflow_id}/permissions/{user_id}",
    response_model=ApiResponse[WorkflowShareResponse],
    summary="Update user's role for workflow",
)
@require_workflow_permission("share")
async def update_user_role(
    user_id: int,
    role_update: WorkflowRoleUpdateRequest,
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: PermissionService = Depends(get_permission_service),
) -> ApiResponse[WorkflowShareResponse]:
    """
    Update a user's role for a workflow.

    Only the workflow owner may update other users' roles. This endpoint
    cannot transfer or grant OWNER role.

    Requires: SHARE permission (owner or admin)

    Permissions:
    - OWNER: can update roles
    - EDITOR: cannot update roles
    - VIEWER: cannot update roles
    - ADMIN: can update roles (bypass)
    """
    await service.update_user_role(
        workflow=workflow, user_id=user_id, new_role=role_update.role
    )

    response = WorkflowShareResponse(
        status="success",
        message=f"User role updated to {role_update.role.value}",
    )
    return ApiResponse(success=True, message="Role updated", data=response)
