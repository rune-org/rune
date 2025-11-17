from functools import wraps
from typing import Callable


def require_workflow_permission(action: str):
    """
    Decorator to check workflow-level permissions.

    This decorator marks a route handler as requiring a specific permission.
    The actual permission checking happens in the dependency layer.

    Args:
        action: The action being performed. Valid values:
               'view', 'edit', 'execute', 'delete', 'share'

    Usage:
        @router.get("/{workflow_id}")
        @require_workflow_permission("view")
        async def get_workflow(
            workflow: Workflow = Depends(get_workflow_with_permission),
            current_user: CurrentUser = ...
        ):
            return workflow
    """

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Permission checking happens in dependency
            # This decorator is mainly for documentation/clarity
            return await func(*args, **kwargs)

        # Store metadata for use in dependencies and OpenAPI docs
        wrapper.__permission_required__ = action
        return wrapper

    return decorator


def require_admin():
    """
    Decorator to enforce admin-only access.

    This decorator marks a route handler as requiring admin privileges.
    The actual admin checking happens through the CurrentAdmin dependency.

    Usage:
        @router.get("/admin/all-workflows")
        @require_admin()
        async def list_all_workflows(
            current_admin: CurrentAdmin = ...,
            db: DatabaseDep = ...
        ):
            return workflows
    """

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await func(*args, **kwargs)

        # Store metadata for OpenAPI docs
        wrapper.__admin_required__ = True
        return wrapper

    return decorator
