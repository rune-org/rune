from src.core.dependencies import DatabaseDep
from src.setup.service import SetupService


async def get_setup_service(db: DatabaseDep) -> SetupService:
    """Dependency to get setup service instance."""
    return SetupService(db=db)
