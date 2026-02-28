from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from redis.asyncio import Redis
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.exceptions import Forbidden, Unauthorized
from src.core.token import decode_access_token
from src.db.config import get_db
from src.db.models import User, UserRole
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

# OAuth2 scheme for Bearer token authentication (API/script clients)
# auto_error=False allows cookie authentication to take precedence
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


async def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
) -> User:
    """
    Extract and validate the current user from the request.

    Supports two authentication methods:
    1. HTTP-only cookie (preferred for browser clients)
    2. OAuth2 Bearer token (for API/script clients)

    The cookie is checked first, then the OAuth2 bearer token as a fallback.
    """
    access_token = None

    # First, try to get token from HTTP-only cookie (browser clients)
    access_token = request.cookies.get("access_token", None)

    # If no cookie, use OAuth2 bearer token (API/script clients)
    if not access_token and token:
        access_token = token

    if not access_token:
        raise Unauthorized(detail="Not authenticated")

    try:
        user = decode_access_token(access_token)
        if not user.is_active:
            raise Forbidden(detail="Account is deactivated")
        return user
    except Exception as e:
        # Re-raise token-specific errors as is, wrap others in Unauthorized
        if isinstance(e, (Unauthorized, Forbidden)):
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


def require_password_changed(current_user: CurrentUser) -> User:
    """
    Enforces password change requirement.
    Blocks access if must_change_password is True.
    """
    if current_user.must_change_password:
        raise Forbidden(
            detail="Password change required. Please set a new password to continue."
        )
    return current_user


RequirePasswordChanged = Annotated[User, Depends(require_password_changed)]
"""
Type alias for authenticated user who has changed their password.
Blocks access if must_change_password flag is True.

Usage:
    from src.core.dependencies import RequirePasswordChanged
    
    @app.get("/workflows")
    async def list_workflows(current_user: RequirePasswordChanged):
        # Only accessible if user has changed their password
        return workflows
"""


def require_admin_role(current_user: RequirePasswordChanged) -> User:
    """
    Enforces admin role requirement with password change enforcement.
    Depends on require_password_changed to ensure admins must change their
    password before accessing admin functions.
    """
    if current_user.role != UserRole.ADMIN:
        raise Forbidden(detail="Admin privileges required")
    return current_user


RequireAdminRole = Annotated[User, Depends(require_admin_role)]


RedisDep = Annotated[Redis, Depends(get_redis)]
