import asyncio

from fastapi import APIRouter, Depends

from src.core.exceptions import BadRequest
from src.core.responses import ApiResponse
from src.smith.schemas import GenerateWorkflowRequest, GeneratedWorkflow
from src.smith.service import SmithAgentService


router = APIRouter(prefix="/workflows", tags=["Workflows"])


def get_smith_service() -> SmithAgentService:
    return SmithAgentService()


@router.post("/smith/generate", response_model=ApiResponse[GeneratedWorkflow])
async def generate_workflow_from_prompt(
    payload: GenerateWorkflowRequest,
    smith: SmithAgentService = Depends(get_smith_service),
) -> ApiResponse[GeneratedWorkflow]:
    """Use Smith to convert a natural-language request into a workflow definition."""
    try:
        result = await asyncio.to_thread(
            smith.generate_workflow,
            prompt=payload.prompt,
            history=payload.history,
            workflow=payload.workflow,
            include_trace=payload.include_trace,
            max_iters=payload.max_iters,
        )
    except ValueError as exc:
        raise BadRequest(detail=str(exc))

    return ApiResponse(
        success=True,
        message="Smith generated a workflow",
        data=result,
    )
