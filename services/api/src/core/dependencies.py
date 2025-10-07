from typing import Annotated
from fastapi import Depends, Request
from redis.asyncio import Redis
from sqlmodel.ext.asyncio.session import AsyncSession

from src.auth.security import decode_access_token
from src.core.exceptions import Unauthorized
from src.db.config import get_db
from src.db.models import User
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
        result = await db.execute(select(User))
        return result.scalars().all()
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

RedisDep = Annotated[Redis, Depends(get_redis)]
