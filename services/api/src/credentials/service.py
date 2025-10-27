from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.models import WorkflowCredential, User
from src.credentials.schemas import CredentialCreate
from src.credentials.encryption import get_encryptor
from src.core.exceptions import AlreadyExists


class CredentialService:
    """Service for managing workflow credentials."""

    def __init__(self, session: AsyncSession):
        """Initialize service with database session."""
        self.session = session
        self.encryptor = get_encryptor()

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
            AlreadyExists: If credential name already exists
        """
        # Check if credential with same name exists
        statement = select(WorkflowCredential).where(
            WorkflowCredential.name == credential_data.name,
        )
        result = await self.session.exec(statement)
        existing = result.first()

        if existing:
            raise AlreadyExists(
                f"Credential with name '{credential_data.name}' already exists"
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

    async def list_credentials(self) -> list[WorkflowCredential]:
        """
        List all credentials.

        Returns:
            List of credential instances
        """
        query = select(WorkflowCredential)

        result = await self.session.exec(query)
        credentials = result.all()
        return list(credentials)


def get_credential_service(session: AsyncSession) -> CredentialService:
    """Get credential service instance."""
    return CredentialService(session)
