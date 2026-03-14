from src.core.dependencies import DatabaseDep
from src.templates.service import TemplateService


def get_template_service(db: DatabaseDep) -> TemplateService:
    """Dependency to get template service instance."""
    return TemplateService(db=db)
