from src.core.dependencies import DatabaseDep
from src.permissions.service import PermissionService


def get_permission_service(db: DatabaseDep) -> PermissionService:
    """Dependency to get workflow permission service instance."""
    return PermissionService(db=db)
