from fastapi import APIRouter, Depends

from src.core.exceptions import NotFound
from src.core.responses import ApiResponse
from src.internal.dependencies import verify_internal_key
from src.workflow.dependencies import get_queue_service, get_workflow_service
from src.workflow.queue import WorkflowQueueService
from src.workflow.service import WorkflowService

router = APIRouter(
    prefix="/internal",
    tags=["Internal"],
    dependencies=[Depends(verify_internal_key)],
)


@router.post("/workflows/{workflow_id}/run", response_model=ApiResponse[str])
async def run_workflow_internal(
    workflow_id: int,
    workflow_service: WorkflowService = Depends(get_workflow_service),
    queue_service: WorkflowQueueService = Depends(get_queue_service),
) -> ApiResponse[str]:
    """Trigger a workflow execution internally (used by the scheduler service)."""
    workflow = await workflow_service.get_by_id(workflow_id)
    if not workflow:
        raise NotFound(detail="Workflow not found")

    execution_id = await workflow_service.queue_workflow_execution(
        workflow=workflow,
        user_id=None,
        queue_service=queue_service,
        token_service=None,
    )
    return ApiResponse(success=True, message="Workflow execution queued", data=execution_id)
