from typing import Annotated, Optional
from fastapi import Depends, Request
from redis.asyncio import Redis
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.auth.security import decode_access_token
from src.core.exceptions import Forbidden, Unauthorized, NotFound
from src.db.config import get_db
from src.db.models import User, UserRole, Workflow, WorkflowUser, WorkflowRole
from src.db.redis import get_redis


# Type aliases for common dependencies using Annotated
# These make it easier to use dependencies in route handlers

DatabaseDep = Annotated[AsyncSession, Depends(get_db)]
"""
Type alias for database session dependency.

Usage:
    @app.get("/users")
    async def get_users(db: DatabaseDep):
        # db is automatically injected as AsyncSession
        result = await db.exec(select(User))
        return result.all()
"""


async def get_current_user(request: Request) -> User:
    access_token = request.cookies.get("access_token", None)

    if not access_token:
        raise Unauthorized(detail="Not authenticated")

    try:
        user = decode_access_token(access_token)
        return user
    except Exception as e:
        # Re-raise token-specific errors as it  is, wrap others in Unauthorized
        if isinstance(e, (Unauthorized,)):
            raise
        raise Unauthorized(detail="Invalid access token")


CurrentUser = Annotated[User, Depends(get_current_user)]
"""
Type alias for authenticated user dependency.

Usage:
    from src.core.dependencies import CurrentUser
    
    @app.get("/profile")
    async def get_profile(current_user: CurrentUser):
        # current_user is automatically injected and validated
        return {"email": current_user.email, "id": current_user.id}
    
    @app.post("/workflows")
    async def create_workflow(
        workflow_data: WorkflowCreate,
        current_user: CurrentUser,
        db: DatabaseDep
    ):
        # Use current_user to associate resources with the authenticated user
        workflow = Workflow(**workflow_data.dict(), user_id=current_user.id)
        db.add(workflow)
        await db.commit()
        return workflow

"""


def get_current_admin(current_user: CurrentUser) -> User:
    if current_user.role != UserRole.ADMIN:
        raise Forbidden(detail="Admin privileges required")
    return current_user


CurrentAdmin = Annotated[User, Depends(get_current_admin)]


RedisDep = Annotated[Redis, Depends(get_redis)]


# ============================================================================
# Authorization Dependencies (Workflow Permissions)
# ============================================================================


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
    current_user: CurrentUser,
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

    Usage:
        @router.get("/{workflow_id}")
        @require_workflow_permission("view")
        async def get_workflow(
            workflow: Workflow = Depends(get_workflow_with_permission),
            current_user: CurrentUser = ...
        ):
            return workflow
    """
    # Import here to avoid circular dependency
    from src.core.policies import WorkflowPolicy

    # Get the route handler to check for permission metadata
    route_handler = request.scope.get("endpoint")
    required_action = getattr(route_handler, "__permission_required__", "view")

    # Fetch workflow
    workflow = await get_workflow_by_id(db, workflow_id)
    if not workflow:
        raise NotFound(detail="Workflow not found")

    # Get user's role for this workflow
    user_role = await get_user_workflow_role(db, current_user.id, workflow_id)

    # Check permission based on action
    policy_method = getattr(WorkflowPolicy, f"can_{required_action}")
    if not policy_method(current_user, user_role):
        raise Forbidden(
            detail=f"Insufficient permissions to {required_action} this workflow"
        )

    return workflow
