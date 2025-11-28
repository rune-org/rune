"""
Test cases for credential management system with access control.

These tests verify:
1. Owner permissions (full control)
2. Admin permissions (view-only for non-owned credentials)
3. Shared user permissions (view-only)
4. Unauthorized access (no permissions)
"""

import pytest
import pytest_asyncio
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import User, UserRole, WorkflowCredential, CredentialType
from src.credentials.service import CredentialService
from src.credentials.permissions import CredentialPermissionService
from src.credentials.schemas import CredentialCreate, CredentialUpdate
from src.core.exceptions import Forbidden, NotFound, BadRequest


@pytest_asyncio.fixture
async def owner_user(test_db: AsyncSession) -> User:
    """Create a regular user who will own credentials."""
    user = User(
        name="Credential Owner",
        email="owner@example.com",
        hashed_password="hashed_password",
        role=UserRole.USER,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_user(test_db: AsyncSession) -> User:
    """Create an admin user."""
    user = User(
        name="System Admin",
        email="admin@example.com",
        hashed_password="hashed_password",
        role=UserRole.ADMIN,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest_asyncio.fixture
async def regular_user(test_db: AsyncSession) -> User:
    """Create another regular user."""
    user = User(
        name="Regular User",
        email="user@example.com",
        hashed_password="hashed_password",
        role=UserRole.USER,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest_asyncio.fixture
async def sample_credential(
    test_db: AsyncSession, owner_user: User
) -> WorkflowCredential:
    """Create a sample credential owned by owner_user."""
    service = CredentialService(test_db)
    credential_data = CredentialCreate(
        name="Test API Key",
        credential_type=CredentialType.API_KEY,
        credential_data={"api_key": "test_key_123", "api_secret": "test_secret_456"},
    )
    credential = await service.create_credential(credential_data, owner_user)
    return credential


class TestOwnerPermissions:
    """Test that credential owners have full control."""

    async def test_owner_can_create_credential(
        self, test_db: AsyncSession, owner_user: User
    ):
        """Owner can create a new credential."""
        service = CredentialService(test_db)
        credential_data = CredentialCreate(
            name="My API Key",
            credential_type=CredentialType.API_KEY,
            credential_data={"api_key": "secret_key"},
        )

        credential = await service.create_credential(credential_data, owner_user)

        assert credential.id is not None
        assert credential.name == "My API Key"
        assert credential.created_by == owner_user.id

    async def test_owner_can_view_own_credential(
        self,
        test_db: AsyncSession,
        owner_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Owner can view their own credential."""
        service = CredentialService(test_db)

        credential = await service.get_credential(sample_credential.id, owner_user)

        assert credential.id == sample_credential.id
        assert credential.name == sample_credential.name

    async def test_owner_can_edit_own_credential(
        self,
        test_db: AsyncSession,
        owner_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Owner can edit their own credential."""
        service = CredentialService(test_db)
        update_data = CredentialUpdate(name="Updated API Key")

        updated = await service.update_credential(
            sample_credential.id, update_data, owner_user
        )

        assert updated.name == "Updated API Key"

    async def test_owner_can_delete_own_credential(
        self,
        test_db: AsyncSession,
        owner_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Owner can delete their own credential."""
        service = CredentialService(test_db)

        await service.delete_credential(sample_credential.id, owner_user)

        # Verify it's deleted
        with pytest.raises(NotFound):
            await service.get_credential(sample_credential.id, owner_user)

    async def test_owner_can_share_own_credential(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Owner can share their credential with another user."""
        permission_service = CredentialPermissionService(test_db)

        share = await permission_service.share_credential(
            sample_credential, regular_user.id, owner_user
        )

        assert share.credential_id == sample_credential.id
        assert share.user_id == regular_user.id
        assert share.shared_by == owner_user.id

    async def test_owner_can_revoke_credential_access(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Owner can revoke access to their credential."""
        permission_service = CredentialPermissionService(test_db)

        # First share it
        await permission_service.share_credential(
            sample_credential, regular_user.id, owner_user
        )

        # Then revoke
        await permission_service.revoke_credential_access(
            sample_credential, regular_user.id, owner_user
        )

        # Verify user can no longer access
        service = CredentialService(test_db)
        with pytest.raises(Forbidden):
            await service.get_credential(sample_credential.id, regular_user)


class TestAdminPermissions:
    """Test that admins can manage all credentials but cannot reshare credentials they don't own."""

    async def test_admin_can_view_all_credentials(
        self,
        test_db: AsyncSession,
        admin_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Admin can view credentials owned by others."""
        service = CredentialService(test_db)

        credential = await service.get_credential(sample_credential.id, admin_user)

        assert credential.id == sample_credential.id

    async def test_admin_can_list_all_credentials(
        self, test_db: AsyncSession, admin_user: User, owner_user: User
    ):
        """Admin can see all credentials in list."""
        service = CredentialService(test_db)

        # Create multiple credentials by different users
        cred1 = await service.create_credential(
            CredentialCreate(
                name="Cred 1",
                credential_type=CredentialType.API_KEY,
                credential_data={},
            ),
            owner_user,
        )
        cred2 = await service.create_credential(
            CredentialCreate(
                name="Cred 2",
                credential_type=CredentialType.API_KEY,
                credential_data={},
            ),
            admin_user,
        )

        credentials = await service.list_credentials(admin_user)

        assert len(credentials) >= 2
        cred_ids = [c.id for c in credentials]
        assert cred1.id in cred_ids
        assert cred2.id in cred_ids

    async def test_admin_can_edit_others_credential(
        self,
        test_db: AsyncSession,
        admin_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Admin can edit credentials owned by others."""
        service = CredentialService(test_db)
        update_data = CredentialUpdate(name="Updated by Admin")

        updated = await service.update_credential(
            sample_credential.id, update_data, admin_user
        )

        assert updated.name == "Updated by Admin"

    async def test_admin_can_delete_others_credential(
        self,
        test_db: AsyncSession,
        admin_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Admin can delete credentials owned by others."""
        service = CredentialService(test_db)

        await service.delete_credential(sample_credential.id, admin_user)

        # Verify it's deleted
        with pytest.raises(NotFound):
            await service.get_credential(sample_credential.id, admin_user)

    async def test_admin_cannot_share_others_credential(
        self,
        test_db: AsyncSession,
        admin_user: User,
        regular_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Admin cannot share credentials they don't own - this is the key security boundary."""
        permission_service = CredentialPermissionService(test_db)

        with pytest.raises(Forbidden, match="Only owners can share"):
            await permission_service.share_credential(
                sample_credential, regular_user.id, admin_user
            )

    async def test_admin_can_manage_own_credentials(
        self, test_db: AsyncSession, admin_user: User
    ):
        """Admin has full control over their own credentials."""
        service = CredentialService(test_db)

        # Create
        credential = await service.create_credential(
            CredentialCreate(
                name="Admin Credential",
                credential_type=CredentialType.API_KEY,
                credential_data={"key": "value"},
            ),
            admin_user,
        )

        # Edit
        updated = await service.update_credential(
            credential.id, CredentialUpdate(name="Updated Admin Credential"), admin_user
        )
        assert updated.name == "Updated Admin Credential"

        # Delete
        await service.delete_credential(credential.id, admin_user)


class TestSharedUserPermissions:
    """Test that shared users have view-only access."""

    async def test_shared_user_can_view_credential(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        sample_credential: WorkflowCredential,
    ):
        """User with shared access can view the credential."""
        permission_service = CredentialPermissionService(test_db)
        service = CredentialService(test_db)

        # Share credential
        await permission_service.share_credential(
            sample_credential, regular_user.id, owner_user
        )

        # User can now view it
        credential = await service.get_credential(sample_credential.id, regular_user)
        assert credential.id == sample_credential.id

    async def test_shared_user_cannot_edit_credential(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        sample_credential: WorkflowCredential,
    ):
        """User with shared access cannot edit the credential."""
        permission_service = CredentialPermissionService(test_db)
        service = CredentialService(test_db)

        # Share credential
        await permission_service.share_credential(
            sample_credential, regular_user.id, owner_user
        )

        # User cannot edit
        with pytest.raises(Forbidden, match="don't have permission to edit"):
            await service.update_credential(
                sample_credential.id,
                CredentialUpdate(name="Hacked"),
                regular_user,
            )

    async def test_shared_user_cannot_delete_credential(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        sample_credential: WorkflowCredential,
    ):
        """User with shared access cannot delete the credential."""
        permission_service = CredentialPermissionService(test_db)
        service = CredentialService(test_db)

        # Share credential
        await permission_service.share_credential(
            sample_credential, regular_user.id, owner_user
        )

        # User cannot delete
        with pytest.raises(Forbidden, match="don't have permission to delete"):
            await service.delete_credential(sample_credential.id, regular_user)

    async def test_shared_user_cannot_reshare_credential(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        admin_user: User,
        sample_credential: WorkflowCredential,
    ):
        """User with shared access cannot share the credential further."""
        permission_service = CredentialPermissionService(test_db)

        # Share credential with regular_user
        await permission_service.share_credential(
            sample_credential, regular_user.id, owner_user
        )

        # regular_user cannot share it with admin_user
        with pytest.raises(Forbidden, match="Only owners can share"):
            await permission_service.share_credential(
                sample_credential, admin_user.id, regular_user
            )


class TestUnauthorizedAccess:
    """Test that users without access cannot view or modify credentials."""

    async def test_unauthorized_user_cannot_view_credential(
        self,
        test_db: AsyncSession,
        regular_user: User,
        sample_credential: WorkflowCredential,
    ):
        """User without access cannot view the credential."""
        service = CredentialService(test_db)

        with pytest.raises(Forbidden, match="don't have permission to view"):
            await service.get_credential(sample_credential.id, regular_user)

    async def test_unauthorized_user_sees_only_accessible_credentials(
        self, test_db: AsyncSession, owner_user: User, regular_user: User
    ):
        """User only sees credentials they have access to."""
        service = CredentialService(test_db)

        # Owner creates a credential
        owner_cred = await service.create_credential(
            CredentialCreate(
                name="Owner's Credential",
                credential_type=CredentialType.API_KEY,
                credential_data={},
            ),
            owner_user,
        )

        # Regular user creates their own credential
        user_cred = await service.create_credential(
            CredentialCreate(
                name="User's Credential",
                credential_type=CredentialType.API_KEY,
                credential_data={},
            ),
            regular_user,
        )

        # Regular user lists credentials
        credentials = await service.list_credentials(regular_user)

        # Should only see their own
        cred_ids = [c.id for c in credentials]
        assert user_cred.id in cred_ids
        assert owner_cred.id not in cred_ids


class TestCredentialSharing:
    """Test credential sharing functionality."""

    async def test_share_creates_access(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Sharing a credential grants view access."""
        permission_service = CredentialPermissionService(test_db)
        service = CredentialService(test_db)

        # Before sharing, user cannot access
        with pytest.raises(Forbidden):
            await service.get_credential(sample_credential.id, regular_user)

        # Share credential
        await permission_service.share_credential(
            sample_credential, regular_user.id, owner_user
        )

        # After sharing, user can access
        credential = await service.get_credential(sample_credential.id, regular_user)
        assert credential.id == sample_credential.id

    async def test_cannot_share_twice(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Cannot share the same credential with the same user twice."""
        permission_service = CredentialPermissionService(test_db)

        # Share once
        await permission_service.share_credential(
            sample_credential, regular_user.id, owner_user
        )

        # Try to share again
        with pytest.raises(BadRequest, match="already shared"):
            await permission_service.share_credential(
                sample_credential, regular_user.id, owner_user
            )

    async def test_cannot_share_with_self(
        self,
        test_db: AsyncSession,
        owner_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Cannot share credential with yourself."""
        permission_service = CredentialPermissionService(test_db)

        with pytest.raises(BadRequest, match="Cannot share credential with yourself"):
            await permission_service.share_credential(
                sample_credential, owner_user.id, owner_user
            )

    async def test_list_credential_shares(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        admin_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Owner can list who has access to their credential."""
        permission_service = CredentialPermissionService(test_db)

        # Share with multiple users
        await permission_service.share_credential(
            sample_credential, regular_user.id, owner_user
        )
        await permission_service.share_credential(
            sample_credential, admin_user.id, owner_user
        )

        # List shares
        shares = await permission_service.list_credential_shares(sample_credential.id)

        assert len(shares) == 2
        user_ids = [s.user_id for s in shares]
        assert regular_user.id in user_ids
        assert admin_user.id in user_ids


class TestPermissionFlags:
    """Test that permission flags are correctly set in responses."""

    async def test_owner_has_all_permissions(
        self,
        test_db: AsyncSession,
        owner_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Owner has all permission flags set to True."""
        service = CredentialService(test_db)

        response = await service.enrich_credential_response(
            sample_credential, owner_user
        )

        assert response.is_owner is True
        assert response.can_share is True
        assert response.can_edit is True
        assert response.can_delete is True

    async def test_admin_has_full_permissions_on_others_credential(
        self,
        test_db: AsyncSession,
        admin_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Admin can edit and delete credentials they don't own, but cannot share them."""
        service = CredentialService(test_db)

        response = await service.enrich_credential_response(
            sample_credential, admin_user
        )

        assert response.is_owner is False
        assert (
            response.can_share is False
        )  # Cannot share - this is the security boundary
        assert response.can_edit is True  # Can edit - admins can manage
        assert response.can_delete is True  # Can delete - admins can manage

    async def test_shared_user_has_view_only_permissions(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Shared user has no modification permissions."""
        permission_service = CredentialPermissionService(test_db)
        service = CredentialService(test_db)

        # Share credential
        await permission_service.share_credential(
            sample_credential, regular_user.id, owner_user
        )

        response = await service.enrich_credential_response(
            sample_credential, regular_user
        )

        assert response.is_owner is False
        assert response.can_share is False
        assert response.can_edit is False
        assert response.can_delete is False


class TestComplexSharingScenarios:
    """Test complex credential sharing scenarios."""

    async def test_multiple_users_can_access_same_credential(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        admin_user: User,
    ):
        """Multiple users can have access to the same credential simultaneously."""
        service = CredentialService(test_db)
        permission_service = CredentialPermissionService(test_db)

        # Create third regular user
        third_user = User(
            name="Third User",
            email="third@example.com",
            hashed_password="hashed",
            role=UserRole.USER,
        )
        test_db.add(third_user)
        await test_db.commit()
        await test_db.refresh(third_user)

        # Owner creates credential
        credential = await service.create_credential(
            CredentialCreate(
                name="Shared API Key",
                credential_type=CredentialType.API_KEY,
                credential_data={"key": "value"},
            ),
            owner_user,
        )

        # Share with multiple users
        await permission_service.share_credential(
            credential, regular_user.id, owner_user
        )
        await permission_service.share_credential(credential, admin_user.id, owner_user)
        await permission_service.share_credential(credential, third_user.id, owner_user)

        # All users can access
        assert await service.get_credential(credential.id, owner_user)
        assert await service.get_credential(credential.id, regular_user)
        assert await service.get_credential(credential.id, admin_user)
        assert await service.get_credential(credential.id, third_user)

        # List shares
        shares = await permission_service.list_credential_shares(credential.id)
        assert len(shares) == 3

    async def test_shared_user_can_revoke_own_access(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Shared user can revoke their own access to a credential."""
        permission_service = CredentialPermissionService(test_db)
        service = CredentialService(test_db)

        # Share credential
        await permission_service.share_credential(
            sample_credential, regular_user.id, owner_user
        )

        # User can access
        credential = await service.get_credential(sample_credential.id, regular_user)
        assert credential.id == sample_credential.id

        # User revokes their own access
        await permission_service.revoke_credential_access(
            sample_credential, regular_user.id, regular_user
        )

        # User can no longer access
        with pytest.raises(Forbidden):
            await service.get_credential(sample_credential.id, regular_user)

    async def test_shared_user_cannot_revoke_others_access(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        admin_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Shared user cannot revoke another user's access."""
        permission_service = CredentialPermissionService(test_db)

        # Share with both users
        await permission_service.share_credential(
            sample_credential, regular_user.id, owner_user
        )
        await permission_service.share_credential(
            sample_credential, admin_user.id, owner_user
        )

        # regular_user cannot revoke admin_user's access
        with pytest.raises(Forbidden, match="can only revoke your own access"):
            await permission_service.revoke_credential_access(
                sample_credential, admin_user.id, regular_user
            )

    async def test_admin_can_revoke_any_users_access(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        admin_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Admin can revoke any user's access for oversight."""
        permission_service = CredentialPermissionService(test_db)
        service = CredentialService(test_db)

        # Share with regular user
        await permission_service.share_credential(
            sample_credential, regular_user.id, owner_user
        )

        # Admin revokes regular_user's access
        await permission_service.revoke_credential_access(
            sample_credential, regular_user.id, admin_user
        )

        # User can no longer access
        with pytest.raises(Forbidden):
            await service.get_credential(sample_credential.id, regular_user)

    async def test_owner_can_revoke_access_from_multiple_users(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        admin_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Owner can revoke access from multiple users."""
        permission_service = CredentialPermissionService(test_db)
        service = CredentialService(test_db)

        # Create another regular user (not admin, to avoid admin always having access)
        third_user = User(
            name="Third User",
            email="third3@example.com",
            hashed_password="hashed",
            role=UserRole.USER,
        )
        test_db.add(third_user)
        await test_db.commit()
        await test_db.refresh(third_user)

        # Share with both regular users
        await permission_service.share_credential(
            sample_credential, regular_user.id, owner_user
        )
        await permission_service.share_credential(
            sample_credential, third_user.id, owner_user
        )

        # Revoke from both
        await permission_service.revoke_credential_access(
            sample_credential, regular_user.id, owner_user
        )
        await permission_service.revoke_credential_access(
            sample_credential, third_user.id, owner_user
        )

        # Neither can access
        with pytest.raises(Forbidden):
            await service.get_credential(sample_credential.id, regular_user)
        with pytest.raises(Forbidden):
            await service.get_credential(sample_credential.id, third_user)

    async def test_credential_deletion_removes_all_shares(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        admin_user: User,
    ):
        """Deleting a credential removes all its shares."""
        service = CredentialService(test_db)
        permission_service = CredentialPermissionService(test_db)

        # Create credential
        credential = await service.create_credential(
            CredentialCreate(
                name="Temporary Credential",
                credential_type=CredentialType.API_KEY,
                credential_data={"key": "value"},
            ),
            owner_user,
        )

        # Share with multiple users
        await permission_service.share_credential(
            credential, regular_user.id, owner_user
        )
        await permission_service.share_credential(credential, admin_user.id, owner_user)

        # Verify shares exist
        shares = await permission_service.list_credential_shares(credential.id)
        assert len(shares) == 2

        # Delete credential
        await service.delete_credential(credential.id, owner_user)

        # Shares should be gone (cascade delete)
        shares = await permission_service.list_credential_shares(credential.id)
        assert len(shares) == 0


class TestMultipleCredentialManagement:
    """Test scenarios involving multiple credentials."""

    async def test_user_can_own_multiple_credentials(
        self, test_db: AsyncSession, owner_user: User
    ):
        """User can create and own multiple credentials."""
        service = CredentialService(test_db)

        # Create multiple credentials
        cred1 = await service.create_credential(
            CredentialCreate(
                name="API Key 1",
                credential_type=CredentialType.API_KEY,
                credential_data={"key": "value1"},
            ),
            owner_user,
        )
        cred2 = await service.create_credential(
            CredentialCreate(
                name="OAuth Token",
                credential_type=CredentialType.OAUTH2,
                credential_data={"token": "value2"},
            ),
            owner_user,
        )
        cred3 = await service.create_credential(
            CredentialCreate(
                name="Basic Auth",
                credential_type=CredentialType.BASIC_AUTH,
                credential_data={"username": "user", "password": "pass"},
            ),
            owner_user,
        )

        # List all credentials
        credentials = await service.list_credentials(owner_user)
        cred_ids = [c.id for c in credentials]

        assert cred1.id in cred_ids
        assert cred2.id in cred_ids
        assert cred3.id in cred_ids
        assert len(credentials) >= 3

    async def test_user_can_have_access_to_mixed_owned_and_shared_credentials(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
    ):
        """User can have a mix of owned and shared credentials."""
        service = CredentialService(test_db)
        permission_service = CredentialPermissionService(test_db)

        # User creates their own credential
        owned_cred = await service.create_credential(
            CredentialCreate(
                name="My Own Credential",
                credential_type=CredentialType.API_KEY,
                credential_data={"key": "mine"},
            ),
            regular_user,
        )

        # Another user creates and shares a credential
        shared_cred = await service.create_credential(
            CredentialCreate(
                name="Shared Credential",
                credential_type=CredentialType.API_KEY,
                credential_data={"key": "shared"},
            ),
            owner_user,
        )
        await permission_service.share_credential(
            shared_cred, regular_user.id, owner_user
        )

        # List all accessible credentials
        credentials = await service.list_credentials(regular_user)
        cred_ids = [c.id for c in credentials]

        assert owned_cred.id in cred_ids
        assert shared_cred.id in cred_ids

        # Check permissions on each
        owned_response = await service.enrich_credential_response(
            owned_cred, regular_user
        )
        assert owned_response.is_owner is True
        assert owned_response.can_edit is True
        assert owned_response.can_share is True

        shared_response = await service.enrich_credential_response(
            shared_cred, regular_user
        )
        assert shared_response.is_owner is False
        assert shared_response.can_edit is False
        assert shared_response.can_share is False

    async def test_different_credential_types_have_same_permissions(
        self, test_db: AsyncSession, owner_user: User, regular_user: User
    ):
        """All credential types follow the same permission rules."""
        service = CredentialService(test_db)
        permission_service = CredentialPermissionService(test_db)

        # Create credentials of different types
        api_key = await service.create_credential(
            CredentialCreate(
                name="API Key",
                credential_type=CredentialType.API_KEY,
                credential_data={"key": "value"},
            ),
            owner_user,
        )
        oauth = await service.create_credential(
            CredentialCreate(
                name="OAuth",
                credential_type=CredentialType.OAUTH2,
                credential_data={"token": "value"},
            ),
            owner_user,
        )
        basic = await service.create_credential(
            CredentialCreate(
                name="Basic",
                credential_type=CredentialType.BASIC_AUTH,
                credential_data={"user": "pass"},
            ),
            owner_user,
        )

        # Share all with regular_user
        await permission_service.share_credential(api_key, regular_user.id, owner_user)
        await permission_service.share_credential(oauth, regular_user.id, owner_user)
        await permission_service.share_credential(basic, regular_user.id, owner_user)

        # All should be view-only for shared user
        for cred in [api_key, oauth, basic]:
            response = await service.enrich_credential_response(cred, regular_user)
            assert response.can_edit is False
            assert response.can_delete is False
            assert response.can_share is False


class TestAdminOversightScenarios:
    """Test admin oversight and management capabilities."""

    async def test_admin_can_view_all_shares_for_any_credential(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        admin_user: User,
    ):
        """Admin can view shares for credentials they don't own."""
        service = CredentialService(test_db)
        permission_service = CredentialPermissionService(test_db)

        # Owner creates credential and shares it
        credential = await service.create_credential(
            CredentialCreate(
                name="Shared Credential",
                credential_type=CredentialType.API_KEY,
                credential_data={"key": "value"},
            ),
            owner_user,
        )
        await permission_service.share_credential(
            credential, regular_user.id, owner_user
        )

        # Admin can view shares even though they don't own it
        await permission_service.require_view_shares_access(credential, admin_user)
        shares = await permission_service.list_credential_shares(credential.id)
        assert len(shares) == 1

    async def test_admin_cannot_share_others_credentials_but_can_revoke(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        admin_user: User,
    ):
        """Admin can manage access but cannot create new shares for others' credentials."""
        service = CredentialService(test_db)
        permission_service = CredentialPermissionService(test_db)

        # Create third user
        third_user = User(
            name="Third User",
            email="third2@example.com",
            hashed_password="hashed",
            role=UserRole.USER,
        )
        test_db.add(third_user)
        await test_db.commit()
        await test_db.refresh(third_user)

        # Owner creates and shares credential
        credential = await service.create_credential(
            CredentialCreate(
                name="Test Credential",
                credential_type=CredentialType.API_KEY,
                credential_data={"key": "value"},
            ),
            owner_user,
        )
        await permission_service.share_credential(
            credential, regular_user.id, owner_user
        )

        # Admin cannot share with third_user
        with pytest.raises(Forbidden, match="Only owners can share"):
            await permission_service.share_credential(
                credential, third_user.id, admin_user
            )

        # But admin can revoke regular_user's access
        await permission_service.revoke_credential_access(
            credential, regular_user.id, admin_user
        )

        # Verify revoke worked
        with pytest.raises(Forbidden):
            await service.get_credential(credential.id, regular_user)

    async def test_admin_edits_are_reflected_for_all_users(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        admin_user: User,
    ):
        """When admin edits a credential, changes are visible to all users with access."""
        service = CredentialService(test_db)
        permission_service = CredentialPermissionService(test_db)

        # Owner creates and shares credential
        credential = await service.create_credential(
            CredentialCreate(
                name="Original Name",
                credential_type=CredentialType.API_KEY,
                credential_data={"key": "value"},
            ),
            owner_user,
        )
        await permission_service.share_credential(
            credential, regular_user.id, owner_user
        )

        # Admin updates the credential
        await service.update_credential(
            credential.id,
            CredentialUpdate(name="Admin Updated Name"),
            admin_user,
        )

        # Both owner and shared user see the update
        owner_view = await service.get_credential(credential.id, owner_user)
        assert owner_view.name == "Admin Updated Name"

        user_view = await service.get_credential(credential.id, regular_user)
        assert user_view.name == "Admin Updated Name"

    async def test_admin_can_delete_credential_removing_all_access(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        admin_user: User,
    ):
        """Admin can delete any credential, removing access for all users."""
        service = CredentialService(test_db)
        permission_service = CredentialPermissionService(test_db)

        # Owner creates and shares credential
        credential = await service.create_credential(
            CredentialCreate(
                name="To Be Deleted",
                credential_type=CredentialType.API_KEY,
                credential_data={"key": "value"},
            ),
            owner_user,
        )
        await permission_service.share_credential(
            credential, regular_user.id, owner_user
        )

        # Admin deletes the credential
        await service.delete_credential(credential.id, admin_user)

        # Neither owner nor shared user can access it
        with pytest.raises(NotFound):
            await service.get_credential(credential.id, owner_user)
        with pytest.raises(NotFound):
            await service.get_credential(credential.id, regular_user)


class TestEdgeCases:
    """Test edge cases and error conditions."""

    async def test_cannot_revoke_access_that_doesnt_exist(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Cannot revoke access for a user who doesn't have access."""
        permission_service = CredentialPermissionService(test_db)

        # Try to revoke without sharing first
        with pytest.raises(BadRequest, match="not shared with this user"):
            await permission_service.revoke_credential_access(
                sample_credential, regular_user.id, owner_user
            )

    async def test_sharing_with_nonexistent_user_fails(
        self,
        test_db: AsyncSession,
        owner_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Cannot share with a user that doesn't exist."""
        permission_service = CredentialPermissionService(test_db)

        with pytest.raises(NotFound, match="Target user not found"):
            await permission_service.share_credential(
                sample_credential, 99999, owner_user
            )

    async def test_accessing_nonexistent_credential_fails(
        self, test_db: AsyncSession, owner_user: User
    ):
        """Cannot access a credential that doesn't exist."""
        service = CredentialService(test_db)

        with pytest.raises(NotFound):
            await service.get_credential(99999, owner_user)

    async def test_regular_user_cannot_view_other_users_shares(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Regular user cannot view shares for credentials they don't own."""
        permission_service = CredentialPermissionService(test_db)

        # regular_user tries to view shares for owner's credential
        with pytest.raises(Forbidden, match="Only owners and admins can view shares"):
            await permission_service.require_view_shares_access(
                sample_credential, regular_user
            )

    async def test_shared_user_cannot_view_shares_list(
        self,
        test_db: AsyncSession,
        owner_user: User,
        regular_user: User,
        admin_user: User,
        sample_credential: WorkflowCredential,
    ):
        """Shared user cannot view the list of who else has access."""
        permission_service = CredentialPermissionService(test_db)

        # Share with regular_user and admin_user
        await permission_service.share_credential(
            sample_credential, regular_user.id, owner_user
        )
        await permission_service.share_credential(
            sample_credential, admin_user.id, owner_user
        )

        # regular_user (who has the credential shared with them) cannot view shares
        with pytest.raises(Forbidden, match="Only owners and admins can view shares"):
            await permission_service.require_view_shares_access(
                sample_credential, regular_user
            )
