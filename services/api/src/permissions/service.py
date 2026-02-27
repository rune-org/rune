"""
Service layer for workflow permissions and sharing operations.
"""

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.exceptions import BadRequest, NotFound
from src.db.models import User, Workflow, WorkflowRole, WorkflowUser
from src.permissions.schemas import WorkflowPermissionInfo


class PermissionService:
    """Service for managing workflow permissions and sharing."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def share_workflow(
        self,
        workflow: Workflow,
        target_user_id: int,
        role: WorkflowRole,
        granted_by: int,
    ) -> WorkflowUser:
        """
        Share a workflow with another user by granting them a specific role.

        Args:
            workflow: The workflow to share
            target_user_id: ID of the user to grant access to
            role: Role to grant (EDITOR or VIEWER, not OWNER)
            granted_by: ID of the user granting access

        Returns:
            The created WorkflowUser record

        Raises:
            NotFound: If target user doesn't exist
            BadRequest: If user already has access or trying to grant OWNER role
        """
        # Validate target user exists
        target_user = await self.db.get(User, target_user_id)
        if not target_user:
            raise NotFound(detail="User not found")

        # Check if already shared
        stmt = select(WorkflowUser).where(
            WorkflowUser.workflow_id == workflow.id,
            WorkflowUser.user_id == target_user_id,
        )
        result = await self.db.exec(stmt)
        existing = result.first()
        if existing:
            raise BadRequest(detail="User already has access to this workflow")

        # Cannot grant OWNER role through sharing
        if role == WorkflowRole.OWNER:
            raise BadRequest(detail="Cannot grant OWNER role through sharing")

        # Create permission record
        workflow_user = WorkflowUser(
            workflow_id=workflow.id,
            user_id=target_user_id,
            role=role,
            granted_by=granted_by,
        )
        self.db.add(workflow_user)
        await self.db.commit()
        await self.db.refresh(workflow_user)

        return workflow_user

    async def revoke_workflow_access(self, workflow: Workflow, user_id: int) -> None:
        """
        Revoke a user's access to a workflow.

        Args:
            workflow: The workflow to revoke access from
            user_id: ID of the user to revoke access from

        Raises:
            BadRequest: If trying to revoke owner's access or user has no access
        """
        # Get the user's current role
        stmt = select(WorkflowUser).where(
            WorkflowUser.workflow_id == workflow.id,
            WorkflowUser.user_id == user_id,
        )
        result = await self.db.exec(stmt)
        workflow_user = result.first()

        if not workflow_user:
            raise BadRequest(detail="User does not have access to this workflow")

        # Cannot revoke owner's access
        if workflow_user.role == WorkflowRole.OWNER:
            raise BadRequest(detail="Cannot revoke owner's access")

        # Delete permission record
        await self.db.delete(workflow_user)
        await self.db.commit()

    async def list_workflow_permissions(
        self, workflow_id: int
    ) -> list[WorkflowPermissionInfo]:
        """
        List all users who have access to a workflow.

        Args:
            workflow_id: ID of the workflow

        Returns:
            List of WorkflowPermissionInfo objects
        """
        stmt = (
            select(WorkflowUser, User)
            .join(User, WorkflowUser.user_id == User.id)
            .where(WorkflowUser.workflow_id == workflow_id)
            .order_by(WorkflowUser.role, User.email)
        )
        result = await self.db.exec(stmt)
        rows = result.all()

        permissions = []
        for workflow_user, user in rows:
            permissions.append(
                WorkflowPermissionInfo(
                    user_id=user.id,
                    user_email=user.email,
                    user_name=user.name,
                    role=workflow_user.role,
                    granted_at=workflow_user.created_at,
                    granted_by=workflow_user.granted_by,
                )
            )

        return permissions

    async def update_user_role(
        self, workflow: Workflow, user_id: int, new_role: WorkflowRole
    ) -> WorkflowUser:
        """
        Update a user's role for a workflow.

        Args:
            workflow: The workflow
            user_id: ID of the user
            new_role: New role to assign

        Returns:
            Updated WorkflowUser record

        Raises:
            BadRequest: If trying to change owner role or user has no access
        """
        stmt = select(WorkflowUser).where(
            WorkflowUser.workflow_id == workflow.id,
            WorkflowUser.user_id == user_id,
        )
        result = await self.db.exec(stmt)
        workflow_user = result.first()

        if not workflow_user:
            raise BadRequest(detail="User does not have access to this workflow")

        # Cannot change owner role
        if workflow_user.role == WorkflowRole.OWNER:
            raise BadRequest(detail="Cannot change owner's role")

        # Cannot change to owner role
        if new_role == WorkflowRole.OWNER:
            raise BadRequest(detail="Cannot grant OWNER role through role update")

        workflow_user.role = new_role
        self.db.add(workflow_user)
        await self.db.commit()
        await self.db.refresh(workflow_user)

        return workflow_user
