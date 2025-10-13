from fastapi import APIRouter, Depends, status

from src.workflow.schemas import (
    WorkflowListItem,
    WorkflowCreate,
    WorkflowDetail,
    WorkflowUpdateName,
    WorkflowUpdateStatus,
)
from src.workflow.service import WorkflowService
from src.core.dependencies import DatabaseDep, get_current_user
from src.core.responses import ApiResponse
from src.db.models import User


router = APIRouter(prefix="/workflows", tags=["Workflows"])


def get_workflow_service(db: DatabaseDep) -> WorkflowService:
    return WorkflowService(db=db)


@router.get("/", response_model=ApiResponse[list[WorkflowListItem]])
async def list_workflows(
    current_user: User = Depends(get_current_user),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[list[WorkflowListItem]]:
    wfs = await service.list_for_user(current_user.id)
    items = [
        WorkflowListItem(id=wf.id, name=wf.name, is_active=wf.is_active) for wf in wfs
    ]
    return ApiResponse(success=True, message="Workflows retrieved", data=items)


@router.get("/{workflow_id}", response_model=ApiResponse[WorkflowDetail])
async def get_workflow(
    workflow_id: int,
    current_user: User = Depends(get_current_user),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowDetail]:
    wf = await service.get_for_user(workflow_id, current_user.id)

    detail = WorkflowDetail.model_validate(wf)

    return ApiResponse(success=True, message="Workflow retrieved", data=detail)


@router.post(
    "/", response_model=ApiResponse[WorkflowDetail], status_code=status.HTTP_201_CREATED
)
async def create_workflow(
    payload: WorkflowCreate,
    current_user: User = Depends(get_current_user),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowDetail]:
    wf = await service.create(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        workflow_data=payload.workflow_data,
    )

    detail = WorkflowDetail.model_validate(wf)

    return ApiResponse(success=True, message="Workflow created", data=detail)


@router.put("/{workflow_id}/status", response_model=ApiResponse[WorkflowDetail])
async def update_status(
    workflow_id: int,
    payload: WorkflowUpdateStatus,
    current_user: User = Depends(get_current_user),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowDetail]:
    wf = await service.get_for_user(workflow_id, current_user.id)
    wf = await service.update_status(wf, payload.is_active)

    detail = WorkflowDetail.model_validate(wf)

    return ApiResponse(success=True, message="Workflow status updated", data=detail)


@router.put("/{workflow_id}/name", response_model=ApiResponse[WorkflowDetail])
async def update_name(
    workflow_id: int,
    payload: WorkflowUpdateName,
    current_user: User = Depends(get_current_user),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowDetail]:
    wf = await service.get_for_user(workflow_id, current_user.id)
    wf = await service.update_name(wf, payload.name)

    detail = WorkflowDetail.model_validate(wf)

    return ApiResponse(success=True, message="Workflow name updated", data=detail)


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: int,
    current_user: User = Depends(get_current_user),
    service: WorkflowService = Depends(get_workflow_service),
) -> None:
    wf = await service.get_for_user(workflow_id, current_user.id)
    await service.delete(wf)
    return
