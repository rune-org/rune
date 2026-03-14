from fastapi import APIRouter, Depends

from src.core.exceptions import BadRequest
from src.core.responses import ApiResponse
from src.db.models import Workflow
from src.scryb.generator import DocumentationGenerator
from src.scryb.schemas import GenerateWorkflowDocsRequest, WorkflowDetailDocs
from src.workflow.dependencies import get_workflow_service, get_workflow_with_permission
from src.workflow.permissions import require_workflow_permission
from src.workflow.service import WorkflowService

router = APIRouter(prefix="/scryb", tags=["Scryb"])


@router.post("/{workflow_id}", response_model=ApiResponse[WorkflowDetailDocs])
@require_workflow_permission("view")
async def generate_workflow_docs(
    style_request: GenerateWorkflowDocsRequest,
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: WorkflowService = Depends(get_workflow_service),
):
    """Generate documentation for the specified workflow."""

    workflow_data = await service.get_latest_workflow_data(workflow)
    if workflow_data is None:
        raise BadRequest(detail="Workflow has no saved versions")

    workflow_data["id"] = str(workflow.id)
    workflow_data["name"] = workflow.name
    workflow_data["description"] = workflow.description

    # 2. Generate Documentation
    generator = DocumentationGenerator()
    docs = await generator.generate(workflow_data, style_request.target_audience)

    return ApiResponse(data=WorkflowDetailDocs(docs=docs))
