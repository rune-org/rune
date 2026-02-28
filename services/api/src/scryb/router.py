from fastapi import APIRouter, Depends

from src.core.dependencies import DatabaseDep
from src.core.responses import ApiResponse
from src.db.models import Workflow
from src.scryb.generator import DocumentationGenerator
from src.scryb.schemas import GenerateWorkflowDocsRequest, WorkflowDetailDocs
from src.workflow.dependencies import get_workflow_with_permission
from src.workflow.permissions import require_workflow_permission
from src.workflow.service import WorkflowService

router = APIRouter(prefix="/scryb", tags=["Scryb"])


def get_workflow_service(db: DatabaseDep) -> WorkflowService:
    """Dependency to get workflow service instance."""
    return WorkflowService(db=db)


@router.post("/{workflow_id}", response_model=ApiResponse[WorkflowDetailDocs])
@require_workflow_permission("view")
async def generate_workflow_docs(
    style_request: GenerateWorkflowDocsRequest,
    workflow: Workflow = Depends(get_workflow_with_permission),
):
    """Generate documentation for the specified workflow."""

    # 1. Prepare Workflow Data
    workflow_data = workflow.workflow_data.copy() if workflow.workflow_data else {}

    workflow_data["id"] = str(workflow.id)
    workflow_data["name"] = workflow.name
    workflow_data["description"] = workflow.description

    # 2. Generate Documentation
    generator = DocumentationGenerator()
    docs = await generator.generate(workflow_data, style_request.target_audience)

    return ApiResponse(data=WorkflowDetailDocs(docs=docs))
