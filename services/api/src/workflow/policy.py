"""
Authorization policies for workflow access control.

This module defines the business logic for what each role can do with workflows.
Uses a cleaner, more maintainable dict-based architecture to reduce code duplication.
"""

from typing import Optional
from src.db.models import User, UserRole, WorkflowRole


class WorkflowPolicy:
    """
    Configuration: Map actions to allowed roles.

    This dict-based approach makes it easier to:
    - See all permissions at a glance
    - Add new actions without duplicating code
    - Maintain consistency across permission checks
    """

    _PERMISSIONS = {
        "view": {WorkflowRole.OWNER, WorkflowRole.EDITOR, WorkflowRole.VIEWER},
        "edit": {WorkflowRole.OWNER, WorkflowRole.EDITOR},
        "execute": {WorkflowRole.OWNER, WorkflowRole.EDITOR},
        "delete": {WorkflowRole.OWNER},
        "share": {WorkflowRole.OWNER},
    }

    @classmethod
    def _check(cls, action: str, user: User, user_role: Optional[WorkflowRole]) -> bool:
        """
        Core permission check logic.

        Args:
            action: The action being performed (e.g., 'view', 'edit')
            user: The user attempting the action
            user_role: The user's role for the specific workflow (or None)

        Returns:
            bool: True if user has permission, False otherwise
        """
        # Admins bypass all checks and have full access
        if user.role == UserRole.ADMIN:
            return True

        # Check if user_role is in the allowed roles for this action
        return user_role in cls._PERMISSIONS.get(action, set())

    @classmethod
    def can_view(cls, user: User, user_role: Optional[WorkflowRole]) -> bool:
        """
        Check if user can view the workflow.

        - Admins can view everything
        - Users with OWNER, EDITOR, or VIEWER role can view
        """
        return cls._check("view", user, user_role)

    @classmethod
    def can_edit(cls, user: User, user_role: Optional[WorkflowRole]) -> bool:
        """
        Check if user can edit the workflow.

        - Admins can edit everything
        - Only OWNER and EDITOR can modify
        """
        return cls._check("edit", user, user_role)

    @classmethod
    def can_execute(cls, user: User, user_role: Optional[WorkflowRole]) -> bool:
        """
        Check if user can execute the workflow.

        - Admins can execute everything
        - VIEWER cannot execute (read-only)
        - OWNER and EDITOR can execute
        """
        return cls._check("execute", user, user_role)

    @classmethod
    def can_delete(cls, user: User, user_role: Optional[WorkflowRole]) -> bool:
        """
        Check if user can delete the workflow.

        - Admins can delete everything
        - Only OWNER can delete
        """
        return cls._check("delete", user, user_role)

    @classmethod
    def can_share(cls, user: User, user_role: Optional[WorkflowRole]) -> bool:
        """
        Check if user can share the workflow with others.

        - Admins can share everything
        - Only OWNER can share/invite others
        """
        return cls._check("share", user, user_role)
