from fastapi import APIRouter, Depends

from src.core.exceptions import BadRequest
from src.core.responses import ApiResponse
from src.db.models import Workflow
from src.scryb.dependencies import get_scryb_service
from src.scryb.schemas import GenerateWorkflowDocsRequest, WorkflowDetailDocs
from src.scryb.service import ScrybService
from src.workflow.dependencies import get_workflow_with_permission
from src.workflow.permissions import require_workflow_permission

router = APIRouter(prefix="/scryb", tags=["Scryb"])


@router.post("/{workflow_id}", response_model=ApiResponse[WorkflowDetailDocs])
@require_workflow_permission("view")
async def generate_workflow_docs(
    style_request: GenerateWorkflowDocsRequest,
    workflow: Workflow = Depends(get_workflow_with_permission),
    scryb_service: ScrybService = Depends(get_scryb_service),
):
    """Generate documentation for the specified workflow."""
    docs = await scryb_service.generate_docs(workflow, style_request)
    if docs is None:
        raise BadRequest(detail="Workflow has no saved versions")

    return ApiResponse(data=WorkflowDetailDocs(docs=docs))
