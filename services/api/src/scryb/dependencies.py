from fastapi import Request

from src.core.dependencies import DatabaseDep
from src.scryb.service import ScrybService
from src.workflow.dependencies import get_workflow_service


def get_scryb_service(request: Request, db: DatabaseDep) -> ScrybService:
    """Build the Scryb service with the startup-built agent from app state."""
    return ScrybService(
        agent=request.app.state.scryb_agent,
        workflow_service=get_workflow_service(db),
    )
