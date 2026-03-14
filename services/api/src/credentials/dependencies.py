from src.core.dependencies import DatabaseDep
from src.credentials.permissions import CredentialPermissionService
from src.credentials.service import CredentialService


def get_credential_service(db: DatabaseDep) -> CredentialService:
    """Dependency to get credential service instance."""
    return CredentialService(session=db)


def get_permission_service(db: DatabaseDep) -> CredentialPermissionService:
    """Dependency to get credential permission service instance."""
    return CredentialPermissionService(db=db)
