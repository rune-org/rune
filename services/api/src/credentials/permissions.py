"""
Credential permission management service.

This module handles access control for credentials with the following rules:
- System Admins: Full access to all credentials (view, edit, delete, but cannot share what they don't own)
- Regular Users: Full control over their own credentials, can only access shared credentials
"""

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import User, UserRole, WorkflowCredential, CredentialShare
from src.core.exceptions import NotFound, Forbidden, BadRequest
from src.credentials.schemas import CredentialShareInfo


class CredentialPermissionService:
    """Service for managing credential permissions and sharing."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def _is_admin(self, user: User) -> bool:
        """Check if user is an admin."""
        return user.role == UserRole.ADMIN

    def _is_owner(self, credential: WorkflowCredential, user: User) -> bool:
        """Check if user owns the credential."""
        return credential.created_by == user.id

    async def can_view(self, credential: WorkflowCredential, user: User) -> bool:
        """
        Check if user can view a credential.

        Admins can view all credentials.
        Users can view credentials they own or that are shared with them.
        """
        if self._is_admin(user):
            return True

        if self._is_owner(credential, user):
            return True

        # Check if shared with user
        stmt = select(CredentialShare).where(
            CredentialShare.credential_id == credential.id,
            CredentialShare.user_id == user.id,
        )
        result = await self.db.exec(stmt)
        return result.first() is not None

    async def can_edit(self, credential: WorkflowCredential, user: User) -> bool:
        """
        Check if user can edit a credential.

        Only owners and admins can edit credentials.
        Shared users cannot edit even if they have view access.
        """
        return self._is_owner(credential, user) or self._is_admin(user)

    async def can_delete(self, credential: WorkflowCredential, user: User) -> bool:
        """
        Check if user can delete a credential.

        Owners can delete their credentials.
        Admins can delete any credential.
        """
        return self._is_owner(credential, user) or self._is_admin(user)

    async def can_share(self, credential: WorkflowCredential, user: User) -> bool:
        """
        Check if user can share a credential.

        Only the owner can share their credentials.
        Admins cannot share credentials they don't own.
        """
        return self._is_owner(credential, user)

    async def require_view_access(
        self, credential: WorkflowCredential, user: User
    ) -> None:
        """Raise Forbidden if user cannot view credential."""
        if not await self.can_view(credential, user):
            raise Forbidden(detail="You don't have permission to view this credential")

    async def require_edit_access(
        self, credential: WorkflowCredential, user: User
    ) -> None:
        """Raise Forbidden if user cannot edit credential."""
        if not await self.can_edit(credential, user):
            raise Forbidden(detail="You don't have permission to edit this credential")

    async def require_delete_access(
        self, credential: WorkflowCredential, user: User
    ) -> None:
        """Raise Forbidden if user cannot delete credential."""
        if not await self.can_delete(credential, user):
            raise Forbidden(
                detail="You don't have permission to delete this credential"
            )

    async def require_share_access(
        self, credential: WorkflowCredential, user: User
    ) -> None:
        """Raise Forbidden if user cannot share credential."""
        if not await self.can_share(credential, user):
            raise Forbidden(
                detail="You don't have permission to share this credential. Only owners can share credentials."
            )

    async def require_view_shares_access(
        self, credential: WorkflowCredential, user: User
    ) -> None:
        """Raise Forbidden if user cannot view credential shares.

        Owners and admins can view shares.
        """
        if not (self._is_owner(credential, user) or self._is_admin(user)):
            raise Forbidden(
                detail="You don't have permission to view shares for this credential. Only owners and admins can view shares."
            )

    async def share_credential(
        self,
        credential: WorkflowCredential,
        target_user_id: int,
        shared_by_user: User,
    ) -> CredentialShare:
        """
        Share a credential with another user.

        Args:
            credential: The credential to share
            target_user_id: ID of the user to share with
            shared_by_user: User performing the share action

        Returns:
            The created CredentialShare record

        Raises:
            Forbidden: If user doesn't have permission to share
            NotFound: If target user doesn't exist
            BadRequest: If credential is already shared with target user
        """
        # Check permission to share
        await self.require_share_access(credential, shared_by_user)

        # Validate target user exists
        target_user = await self.db.get(User, target_user_id)
        if not target_user:
            raise NotFound(detail="Target user not found")

        # Cannot share with yourself
        if target_user_id == shared_by_user.id:
            raise BadRequest(detail="Cannot share credential with yourself")

        # Check if already shared
        stmt = select(CredentialShare).where(
            CredentialShare.credential_id == credential.id,
            CredentialShare.user_id == target_user_id,
        )
        result = await self.db.exec(stmt)
        existing = result.first()
        if existing:
            raise BadRequest(detail="Credential is already shared with this user")

        # Create share record
        share = CredentialShare(
            credential_id=credential.id,
            user_id=target_user_id,
            shared_by=shared_by_user.id,
        )
        self.db.add(share)
        await self.db.commit()
        await self.db.refresh(share)

        return share

    async def revoke_credential_access(
        self,
        credential: WorkflowCredential,
        target_user_id: int,
        revoking_user: User,
    ) -> None:
        """
        Revoke a user's access to a credential.

        Args:
            credential: The credential to revoke access from
            target_user_id: ID of the user to revoke access from
            revoking_user: User performing the revoke action

        Raises:
            Forbidden: If user doesn't have permission to revoke
            BadRequest: If credential is not shared with target user
        """
        # Check permission to revoke
        # - Owner and admin can revoke any user's access
        # - Shared users can only revoke their own access
        is_owner_or_admin = self._is_owner(credential, revoking_user) or self._is_admin(
            revoking_user
        )
        is_revoking_self = target_user_id == revoking_user.id

        if not (is_owner_or_admin or is_revoking_self):
            raise Forbidden(
                detail="You don't have permission to revoke access. You can only revoke your own access to shared credentials."
            )

        # Get share record
        stmt = select(CredentialShare).where(
            CredentialShare.credential_id == credential.id,
            CredentialShare.user_id == target_user_id,
        )
        result = await self.db.exec(stmt)
        share = result.first()

        if not share:
            raise BadRequest(detail="Credential is not shared with this user")

        # Delete share record
        await self.db.delete(share)
        await self.db.commit()

    async def list_credential_shares(
        self, credential_id: int
    ) -> list[CredentialShareInfo]:
        """
        List all users who have access to a credential.

        Args:
            credential_id: ID of the credential

        Returns:
            List of CredentialShareInfo objects
        """
        stmt = (
            select(CredentialShare, User)
            .join(User, CredentialShare.user_id == User.id)
            .where(CredentialShare.credential_id == credential_id)
            .order_by(User.email)
        )
        result = await self.db.exec(stmt)
        rows = result.all()

        shares = []
        for share, user in rows:
            shares.append(
                CredentialShareInfo(
                    user_id=user.id,
                    user_email=user.email,
                    user_name=user.name,
                    shared_at=share.created_at,
                    shared_by=share.shared_by,
                )
            )

        return shares

    async def get_accessible_credentials(self, user: User) -> list[WorkflowCredential]:
        """
        Get all credentials accessible to a user.

        Admins get all credentials.
        Regular users get credentials they own or that are shared with them.
        """
        if self._is_admin(user):
            # Admins can see all credentials
            stmt = select(WorkflowCredential).order_by(WorkflowCredential.name)
            result = await self.db.exec(stmt)
            return list(result.all())

        # Get owned credentials
        owned_stmt = (
            select(WorkflowCredential)
            .where(WorkflowCredential.created_by == user.id)
            .order_by(WorkflowCredential.name)
        )
        owned_result = await self.db.exec(owned_stmt)
        owned_credentials = list(owned_result.all())

        # Get shared credentials
        shared_stmt = (
            select(WorkflowCredential)
            .join(CredentialShare)
            .where(CredentialShare.user_id == user.id)
            .order_by(WorkflowCredential.name)
        )
        shared_result = await self.db.exec(shared_stmt)
        shared_credentials = list(shared_result.all())

        # Combine and deduplicate (shouldn't have duplicates, but just in case)
        all_credentials = {cred.id: cred for cred in owned_credentials}
        for cred in shared_credentials:
            all_credentials[cred.id] = cred

        return sorted(all_credentials.values(), key=lambda x: x.name)
