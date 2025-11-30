from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import WorkflowCredential, User
from src.credentials.schemas import (
    CredentialCreate,
    CredentialUpdate,
    CredentialResponse,
)
from src.credentials.encryption import get_encryptor
from src.credentials.permissions import CredentialPermissionService
from src.core.exceptions import AlreadyExists, NotFound


class CredentialService:
    """Service for managing workflow credentials with access control."""

    def __init__(self, session: AsyncSession):
        """Initialize service with database session."""
        self.session = session
        self.encryptor = get_encryptor()
        self.permission_service = CredentialPermissionService(session)

    async def create_credential(
        self, credential_data: CredentialCreate, user: User
    ) -> WorkflowCredential:
        """
        Create a new credential with encrypted data.

        Args:
            credential_data: Credential creation data
            user: User creating the credential

        Returns:
            Created credential instance

        Raises:
            AlreadyExists: If credential name already exists for this user
        """
        # Check if credential with same name exists for this user
        statement = select(WorkflowCredential).where(
            WorkflowCredential.name == credential_data.name,
            WorkflowCredential.created_by == user.id,
        )
        result = await self.session.exec(statement)
        existing = result.first()

        if existing:
            raise AlreadyExists(
                f"You already have a credential named '{credential_data.name}'"
            )

        # Encrypt the credential data
        encrypted_data = self.encryptor.encrypt_credential_data(
            credential_data.credential_data
        )

        credential = WorkflowCredential(
            name=credential_data.name,
            credential_type=credential_data.credential_type,
            credential_data=encrypted_data,
            created_by=user.id,
        )

        self.session.add(credential)
        await self.session.commit()
        await self.session.refresh(credential)

        return credential

    async def get_credential(
        self, credential_id: int, user: User
    ) -> WorkflowCredential:
        """
        Get a credential by ID with access control.

        Args:
            credential_id: ID of the credential
            user: User requesting the credential

        Returns:
            Credential instance

        Raises:
            NotFound: If credential doesn't exist or user doesn't have access
        """
        credential = await self.session.get(WorkflowCredential, credential_id)
        if not credential:
            raise NotFound(detail="Credential not found")

        # Check access
        await self.permission_service.require_view_access(credential, user)

        return credential

    async def update_credential(
        self,
        credential_id: int,
        credential_data: CredentialUpdate,
        user: User,
    ) -> WorkflowCredential:
        """
        Update a credential with access control.

        Args:
            credential_id: ID of the credential to update
            credential_data: Updated credential data
            user: User performing the update

        Returns:
            Updated credential instance

        Raises:
            NotFound: If credential doesn't exist
            Forbidden: If user doesn't have permission to edit
            AlreadyExists: If new name conflicts with another credential
        """
        credential = await self.session.get(WorkflowCredential, credential_id)
        if not credential:
            raise NotFound(detail="Credential not found")

        # Check edit permission
        await self.permission_service.require_edit_access(credential, user)

        # Check for name conflicts if name is being changed
        if credential_data.name and credential_data.name != credential.name:
            statement = select(WorkflowCredential).where(
                WorkflowCredential.name == credential_data.name,
                WorkflowCredential.created_by == user.id,
                WorkflowCredential.id != credential_id,
            )
            result = await self.session.exec(statement)
            existing = result.first()
            if existing:
                raise AlreadyExists(
                    f"You already have a credential named '{credential_data.name}'"
                )
            credential.name = credential_data.name

        # Update credential type if provided
        if credential_data.credential_type:
            credential.credential_type = credential_data.credential_type

        # Update and encrypt credential data if provided
        if credential_data.credential_data is not None:
            encrypted_data = self.encryptor.encrypt_credential_data(
                credential_data.credential_data
            )
            credential.credential_data = encrypted_data

        self.session.add(credential)
        await self.session.commit()
        await self.session.refresh(credential)

        return credential

    async def delete_credential(self, credential_id: int, user: User) -> None:
        """
        Delete a credential with access control.

        Args:
            credential_id: ID of the credential to delete
            user: User performing the delete

        Raises:
            NotFound: If credential doesn't exist
            Forbidden: If user doesn't have permission to delete
        """
        credential = await self.session.get(WorkflowCredential, credential_id)
        if not credential:
            raise NotFound(detail="Credential not found")

        # Check delete permission
        await self.permission_service.require_delete_access(credential, user)

        await self.session.delete(credential)
        await self.session.commit()

    async def list_credentials(self, user: User) -> list[WorkflowCredential]:
        """
        List all credentials accessible to the user.

        Admins see all credentials.
        Regular users see credentials they own or that are shared with them.

        Args:
            user: User requesting the credentials

        Returns:
            List of credential instances
        """
        return await self.permission_service.get_accessible_credentials(user)

    async def enrich_credential_response(
        self, credential: WorkflowCredential, user: User
    ) -> CredentialResponse:
        """
        Enrich credential with permission flags for the current user.

        Args:
            credential: The credential to enrich
            user: The current user

        Returns:
            CredentialResponse with permission flags set
        """
        response = CredentialResponse.model_validate(credential)
        response.is_owner = credential.created_by == user.id
        response.can_share = await self.permission_service.can_share(credential, user)
        response.can_edit = await self.permission_service.can_edit(credential, user)
        response.can_delete = await self.permission_service.can_delete(credential, user)
        return response


def get_credential_service(session: AsyncSession) -> CredentialService:
    """Get credential service instance."""
    return CredentialService(session)
