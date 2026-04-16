from src.core.dependencies import DatabaseDep
from src.scryb.service import ScrybService
from src.workflow.dependencies import get_workflow_service


def get_scryb_service(db: DatabaseDep) -> ScrybService:
    return ScrybService(workflow_service=get_workflow_service(db))
