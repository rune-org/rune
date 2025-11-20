"""
Workflow-specific permission decorators.

This module defines decorators for workflow-level authorization.
These decorators mark route handlers as requiring specific permissions,
with actual validation happening in the dependency layer.
"""

from functools import wraps
from typing import Callable


# Valid workflow actions - used for validation
VALID_WORKFLOW_ACTIONS = {"view", "edit", "execute", "delete", "share"}


def require_workflow_permission(action: str):
    """
    Decorator to check workflow-level permissions.

    This decorator marks a route handler as requiring a specific permission.
    The actual permission checking happens in the dependency layer.

    Args:
        action: The action being performed. Valid values:
               'view', 'edit', 'execute', 'delete', 'share'

    Raises:
        ValueError: If an invalid action is provided

    Usage:
        @router.get("/{workflow_id}")
        @require_workflow_permission("view")
        async def get_workflow(
            workflow: Workflow = Depends(get_workflow_with_permission),
            current_user: CurrentUser = ...
        ):
            return workflow
    """
    # Validate action at decorator creation time
    if action not in VALID_WORKFLOW_ACTIONS:
        raise ValueError(
            f"Invalid permission action '{action}'. "
            f"Valid actions are: {', '.join(sorted(VALID_WORKFLOW_ACTIONS))}"
        )

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
