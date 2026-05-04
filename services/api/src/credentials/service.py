import json
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.redis import get_redis_client


from src.core.exceptions import AlreadyExists, NotFound
from src.credentials.encryption import get_encryptor
from src.credentials.permissions import CredentialPermissionService
from src.credentials.schemas import (
    CredentialCreate,
    CredentialResponse,
    CredentialUpdate,
)
from src.db.models import CredentialType, User, WorkflowCredential
from src.oauth.credential_patch import merge_oauth2_credential_patch


class CredentialService:
    """Service for managing workflow credentials with access control."""

    def __init__(self, session: AsyncSession):
        """Initialize service with database session."""
        self.session = session
        self.encryptor = get_encryptor()
        self.permission_service = CredentialPermissionService(session)

    async def _publish_event(
        self, action: str, credential_id: int, user_id: int | None = None
    ) -> None:
        """Publish a credential event to Redis."""
        redis = get_redis_client()
        data = {"action": action, "credential_id": credential_id}
        if user_id:
            data["user_id"] = user_id
        await redis.publish("credential_events", json.dumps(data))

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
        # Use credential.created_by (owner's ID) not user.id, so admins editing
        # others' credentials check against the owner's namespace
        if credential_data.name and credential_data.name != credential.name:
            statement = select(WorkflowCredential).where(
                WorkflowCredential.name == credential_data.name,
                WorkflowCredential.created_by == credential.created_by,
                WorkflowCredential.id != credential_id,
            )
            result = await self.session.exec(statement)
            existing = result.first()
            if existing:
                raise AlreadyExists(
                    f"A credential named '{credential_data.name}' already exists"
                )
            credential.name = credential_data.name

        # Update credential type if provided
        if credential_data.credential_type:
            credential.credential_type = credential_data.credential_type

        # Update and encrypt credential data if provided
        if credential_data.credential_data is not None:
            effective_type = (
                credential_data.credential_type or credential.credential_type
            )
            if effective_type == CredentialType.OAUTH2:
                current_decrypted = self.encryptor.decrypt_credential_data(
                    credential.credential_data
                )
                merged = merge_oauth2_credential_patch(
                    current_decrypted, credential_data.credential_data
                )
                credential.credential_data = self.encryptor.encrypt_credential_data(
                    merged
                )
            else:
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

        # Publish event
        await self._publish_event("deleted", credential_id)

    async def revoke_credential_access(
        self, credential: WorkflowCredential, target_user_id: int, user: User
    ) -> None:
        """
        Revoke credential access and publish event.
        """
        await self.permission_service.revoke_credential_access(
            credential, target_user_id, user
        )
        await self._publish_event("revoked", credential.id, target_user_id)

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
        if credential.credential_type == CredentialType.OAUTH2:
            decrypted = self.encryptor.decrypt_credential_data(
                credential.credential_data
            )
            response.oauth_connected = bool(decrypted.get("access_token"))
        return response


def get_credential_service(session: AsyncSession) -> CredentialService:
    """Get credential service instance."""
    return CredentialService(session)
