"""
Authorization policies for resource access control.

This module defines the business logic for what each role can do with resources.
Admins bypass all checks and have full access.
"""

from typing import Optional
from src.db.models import User, UserRole, WorkflowRole


class WorkflowPolicy:
    """
    Defines what each role can do with workflows.
    Admins bypass all checks.
    """

    @staticmethod
    def can_view(user: User, user_role: Optional[WorkflowRole]) -> bool:
        """
        Check if user can view the workflow.

        - Admins can view everything
        - Users with OWNER, EDITOR, or VIEWER role can view
        """
        # Admin can view everything
        if user.role == UserRole.ADMIN:
            return True

        # Must have at least VIEWER permission
        return user_role in [
            WorkflowRole.OWNER,
            WorkflowRole.EDITOR,
            WorkflowRole.VIEWER,
        ]

    @staticmethod
    def can_edit(user: User, user_role: Optional[WorkflowRole]) -> bool:
        """
        Check if user can edit the workflow.

        - Admins can edit everything
        - Only OWNER and EDITOR can modify
        """
        if user.role == UserRole.ADMIN:
            return True

        # Only OWNER and EDITOR can modify
        return user_role in [WorkflowRole.OWNER, WorkflowRole.EDITOR]

    @staticmethod
    def can_execute(user: User, user_role: Optional[WorkflowRole]) -> bool:
        """
        Check if user can execute the workflow.

        - Admins can execute everything
        - VIEWER cannot execute (read-only)
        - OWNER and EDITOR can execute
        """
        if user.role == UserRole.ADMIN:
            return True

        # VIEWER cannot execute!
        return user_role in [WorkflowRole.OWNER, WorkflowRole.EDITOR]

    @staticmethod
    def can_delete(user: User, user_role: Optional[WorkflowRole]) -> bool:
        """
        Check if user can delete the workflow.

        - Admins can delete everything
        - Only OWNER can delete
        """
        if user.role == UserRole.ADMIN:
            return True

        # Only OWNER can delete
        return user_role == WorkflowRole.OWNER

    @staticmethod
    def can_share(user: User, user_role: Optional[WorkflowRole]) -> bool:
        """
        Check if user can share the workflow with others.

        - Admins can share everything
        - Only OWNER can share/invite others
        """
        if user.role == UserRole.ADMIN:
            return True

        # Only OWNER can share/invite others
        return user_role == WorkflowRole.OWNER
