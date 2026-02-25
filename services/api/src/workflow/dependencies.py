"""
Workflow-specific dependency functions for authorization.

This module provides dependency functions that handle workflow-level
permission checking and resource fetching.
"""

from typing import Optional

from fastapi import Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.dependencies import DatabaseDep, RequirePasswordChanged
from src.core.exceptions import Forbidden, NotFound
from src.db.models import Workflow, WorkflowRole, WorkflowUser
from src.workflow.permissions import VALID_WORKFLOW_ACTIONS
from src.workflow.policy import WorkflowPolicy


async def get_user_workflow_role(
    db: AsyncSession, user_id: int, workflow_id: int
) -> Optional[WorkflowRole]:
    """
    Returns the user's role for a specific workflow.
    Returns None if user has no access.

    Args:
        db: Database session
        user_id: ID of the user
        workflow_id: ID of the workflow

    Returns:
        WorkflowRole if user has access, None otherwise
    """
    result = await db.exec(
        select(WorkflowUser.role).where(
            WorkflowUser.user_id == user_id, WorkflowUser.workflow_id == workflow_id
        )
    )
    return result.first()


async def get_workflow_by_id(db: AsyncSession, workflow_id: int) -> Optional[Workflow]:
    """
    Fetch a workflow by ID.

    Args:
        db: Database session
        workflow_id: ID of the workflow

    Returns:
        Workflow if found, None otherwise
    """
    return await db.get(Workflow, workflow_id)


async def get_workflow_with_permission(
    workflow_id: int,
    request: Request,
    current_user: RequirePasswordChanged,
    db: DatabaseDep,
) -> Workflow:
    """
    Fetches workflow and validates user has permission.
    Uses the decorator metadata to determine required action.

    This dependency should be used with the @require_workflow_permission decorator.
    It automatically checks the permission based on the action specified in the decorator.

    Args:
        workflow_id: ID of the workflow to fetch
        request: FastAPI request object (used to get route metadata)
        current_user: Currently authenticated user
        db: Database session

    Returns:
        Workflow if user has permission

    Raises:
        NotFound: If workflow doesn't exist
        Forbidden: If user lacks required permission
        ValueError: If an invalid action is detected

    Usage:
        @router.get("/{workflow_id}")
        @require_workflow_permission("view")
        async def get_workflow(
            workflow: Workflow = Depends(get_workflow_with_permission),
            current_user: RequirePasswordChanged  = ...
        ):
            return workflow
    """
    # Get the route handler to check for permission metadata
    route_handler = request.scope.get("endpoint")
    required_action = getattr(route_handler, "__permission_required__", "view")

    # Validate action - this provides better error messages than getattr failures
    if required_action not in VALID_WORKFLOW_ACTIONS:
        raise ValueError(
            f"Invalid permission action '{required_action}'. "
            f"Valid actions are: {', '.join(sorted(VALID_WORKFLOW_ACTIONS))}"
        )

    # Fetch workflow
    workflow = await get_workflow_by_id(db, workflow_id)
    if not workflow:
        raise NotFound(detail="Workflow not found")

    # Get user's role for this workflow
    user_role = await get_user_workflow_role(db, current_user.id, workflow_id)

    # Check permission based on action - validate the method exists
    policy_method = getattr(WorkflowPolicy, f"can_{required_action}", None)
    if policy_method is None:
        raise ValueError(
            f"No policy method found for action '{required_action}'. "
            f"Expected method: WorkflowPolicy.can_{required_action}"
        )

    if not policy_method(current_user, user_role):
        raise Forbidden(
            detail=f"Insufficient permissions to {required_action} this workflow"
        )

    return workflow
