import uuid

from fastapi import APIRouter, Depends, Response, status

from src.core.config import get_settings
from src.core.dependencies import (
    DatabaseDep,
    require_password_changed,
)
from src.core.exceptions import BadRequest, NotFound
from src.core.responses import ApiResponse
from src.db.models import Execution, ExecutionStatus, User, Workflow
from src.executions.service import ExecutionTokenService
from src.queue.rabbitmq import get_rabbitmq
from src.workflow.dependencies import get_workflow_with_permission
from src.workflow.permissions import require_workflow_permission
from src.workflow.queue import WorkflowQueueService
from src.workflow.schemas import (
    WorkflowCreate,
    WorkflowCreateVersion,
    WorkflowDetail,
    WorkflowListItem,
    WorkflowPublishVersion,
    WorkflowRestoreVersion,
    WorkflowRunRequest,
    WorkflowUpdateName,
    WorkflowUpdateStatus,
    WorkflowVersionConflict,
    WorkflowVersionDetail,
    WorkflowVersionListItem,
)
from src.workflow.service import WorkflowService, WorkflowVersionConflictError

router = APIRouter(prefix="/workflows", tags=["Workflows"])


def get_workflow_service(db: DatabaseDep) -> WorkflowService:
    """Dependency to get workflow service instance."""
    return WorkflowService(db=db)


def get_queue_service(connection=Depends(get_rabbitmq)) -> WorkflowQueueService:
    """Dependency to get workflow queue service instance."""
    return WorkflowQueueService(
        connection=connection, queue_name=get_settings().rabbitmq_workflow_queue
    )


def get_token_service(connection=Depends(get_rabbitmq)) -> ExecutionTokenService:
    """Dependency to get execution token service instance."""
    return ExecutionTokenService(
        connection=connection, queue_name=get_settings().rabbitmq_token_queue
    )


@router.get("/", response_model=ApiResponse[list[WorkflowListItem]])
async def list_workflows(
    current_user: User = Depends(require_password_changed),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[list[WorkflowListItem]]:
    wfs = await service.list_for_user(current_user.id)
    items = [
        WorkflowListItem(id=wf.id, name=wf.name, is_active=wf.is_active, role=role)
        for wf, role in wfs
    ]
    return ApiResponse(success=True, message="Workflows retrieved", data=items)


@router.get("/{workflow_id}", response_model=ApiResponse[WorkflowDetail])
@require_workflow_permission("view")
async def get_workflow(
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowDetail]:
    """
    Get a specific workflow by ID.

    **Requires:** VIEW permission (OWNER, EDITOR, or VIEWER)
    """
    detail = WorkflowDetail.from_workflow(
        workflow, await service.get_latest_version_with_creator(workflow)
    )
    return ApiResponse(success=True, message="Workflow retrieved", data=detail)


@router.post(
    "/",
    response_model=ApiResponse[WorkflowDetail],
    status_code=status.HTTP_201_CREATED,
)
async def create_workflow(
    payload: WorkflowCreate,
    current_user: User = Depends(require_password_changed),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowDetail]:
    wf = await service.create(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description or "",
    )
    detail = WorkflowDetail.from_workflow(wf, None)
    return ApiResponse(success=True, message="Workflow created", data=detail)


@router.put("/{workflow_id}/status", response_model=ApiResponse[WorkflowDetail])
@require_workflow_permission("edit")
async def update_status(
    payload: WorkflowUpdateStatus,
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowDetail]:
    """
    Update workflow status (active/inactive).

    In the versioned model, activating publishes the latest saved version and
    deactivating clears the published pointer.

    **Requires:** EDIT permission (OWNER or EDITOR)
    """
    wf = await service.update_status(workflow, payload.is_active)
    detail = WorkflowDetail.from_workflow(
        wf, await service.get_latest_version_with_creator(wf)
    )
    return ApiResponse(success=True, message="Workflow status updated", data=detail)


@router.put("/{workflow_id}/name", response_model=ApiResponse[WorkflowDetail])
@require_workflow_permission("edit")
async def update_name(
    payload: WorkflowUpdateName,
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowDetail]:
    """
    Update workflow name.

    **Requires:** EDIT permission (OWNER or EDITOR)
    """
    wf = await service.update_name(workflow, payload.name)
    detail = WorkflowDetail.from_workflow(
        wf, await service.get_latest_version_with_creator(wf)
    )
    return ApiResponse(success=True, message="Workflow name updated", data=detail)


@router.get(
    "/{workflow_id}/versions",
    response_model=ApiResponse[list[WorkflowVersionListItem]],
)
@require_workflow_permission("view")
async def list_workflow_versions(
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[list[WorkflowVersionListItem]]:
    versions = [
        WorkflowVersionListItem.from_version(
            version,
            workflow.published_version_id,
            creator,
        )
        for version, creator in await service.list_versions(workflow.id)
    ]
    return ApiResponse(
        success=True, message="Workflow versions retrieved", data=versions
    )


@router.get(
    "/{workflow_id}/versions/{version_id}",
    response_model=ApiResponse[WorkflowVersionDetail],
)
@require_workflow_permission("view")
async def get_workflow_version(
    version_id: int,
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowVersionDetail]:
    version_tuple = await service.get_version_with_creator(workflow.id, version_id)
    if version_tuple is None:
        raise NotFound(detail="Workflow version not found")

    version, creator = version_tuple
    detail = WorkflowVersionDetail.from_version(
        version,
        workflow.published_version_id,
        creator,
    )
    return ApiResponse(success=True, message="Workflow version retrieved", data=detail)


@router.post(
    "/{workflow_id}/versions",
    response_model=ApiResponse[WorkflowVersionDetail],
    status_code=status.HTTP_201_CREATED,
    responses={
        status.HTTP_409_CONFLICT: {
            "model": ApiResponse[WorkflowVersionConflict],
            "description": "Someone saved a newer workflow version",
        }
    },
)
@require_workflow_permission("edit")
async def create_workflow_version(
    payload: WorkflowCreateVersion,
    workflow: Workflow = Depends(get_workflow_with_permission),
    current_user: User = Depends(require_password_changed),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowVersionDetail] | Response:
    try:
        version = await service.create_version(
            workflow=workflow,
            user_id=current_user.id,
            workflow_data=payload.workflow_data,
            base_version_id=payload.base_version_id,
            message=payload.message,
        )
    except WorkflowVersionConflictError as exc:
        return WorkflowVersionConflict.to_response(
            exc.server_version, exc.server_version_id
        )

    detail_tuple = await service.get_version_with_creator(workflow.id, version.id)
    version_detail = WorkflowVersionDetail.from_version(
        detail_tuple[0],
        workflow.published_version_id,
        detail_tuple[1],
    )
    return ApiResponse(
        success=True,
        message="Workflow version created",
        data=version_detail,
    )


@router.post("/{workflow_id}/publish", response_model=ApiResponse[WorkflowDetail])
@require_workflow_permission("edit")
async def publish_workflow_version(
    payload: WorkflowPublishVersion,
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowDetail]:
    wf = await service.publish_version(workflow, payload.version_id)
    detail = WorkflowDetail.from_workflow(
        wf, await service.get_latest_version_with_creator(wf)
    )
    return ApiResponse(success=True, message="Workflow published", data=detail)


@router.post(
    "/{workflow_id}/restore/{version_id}",
    response_model=ApiResponse[WorkflowVersionDetail],
    status_code=status.HTTP_201_CREATED,
)
@require_workflow_permission("edit")
async def restore_workflow_version(
    version_id: int,
    payload: WorkflowRestoreVersion | None = None,
    workflow: Workflow = Depends(get_workflow_with_permission),
    current_user: User = Depends(require_password_changed),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowVersionDetail]:
    restored = await service.restore_version(
        workflow=workflow,
        source_version_id=version_id,
        user_id=current_user.id,
        message=payload.message if payload else None,
    )
    detail_tuple = await service.get_version_with_creator(workflow.id, restored.id)
    detail = WorkflowVersionDetail.from_version(
        detail_tuple[0],
        workflow.published_version_id,
        detail_tuple[1],
    )
    return ApiResponse(success=True, message="Workflow version restored", data=detail)


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_workflow_permission("delete")
async def delete_workflow(
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: WorkflowService = Depends(get_workflow_service),
) -> None:
    """
    Delete a workflow.

    **Requires:** DELETE permission (OWNER only)
    """
    await service.delete(workflow)
    return


@router.post("/{workflow_id}/run", response_model=ApiResponse[str])
@require_workflow_permission("execute")
async def run_workflow(
    db: DatabaseDep,
    payload: WorkflowRunRequest | None = None,
    workflow: Workflow = Depends(get_workflow_with_permission),
    current_user: User = Depends(require_password_changed),
    workflow_service: WorkflowService = Depends(get_workflow_service),
    queue_service: WorkflowQueueService = Depends(get_queue_service),
    token_service: ExecutionTokenService = Depends(get_token_service),
) -> ApiResponse[str]:
    """
    Queue a workflow for execution.

    Verifies the workflow exists and user has execute permission (OWNER or EDITOR),
    resolves all credential references in workflow nodes,
    then publishes a run message to RabbitMQ containing workflow details with
    resolved credentials.
    Also publishes an execution token for RTES real-time updates.

    Returns execution_id for tracking the execution.

    **Requires:** EXECUTE permission (OWNER or EDITOR, not VIEWER)
    """
    version = await workflow_service.get_run_version(
        workflow, payload.version_id if payload else None
    )
    resolved_workflow_data = await workflow_service.resolve_workflow_credentials(
        version.workflow_data
    )
    execution_id = str(uuid.uuid4())

    # TODO: this is bad code — database calls do not belong in the router layer.
    # This should be moved to a service/repository layer and refactored accordingly.
    execution = Execution(
        id=execution_id,
        workflow_id=workflow.id,
        status=ExecutionStatus.PENDING,
    )
    db.add(execution)
    await db.commit()

    # Publish execution token for RTES authentication (with specific execution_id)
    await token_service.publish_execution_token(
        workflow_id=workflow.id,
        user_id=current_user.id,
        execution_id=execution_id,
    )

    try:
        await queue_service.publish_workflow_run(
            workflow_id=workflow.id,
            workflow_version=version.version,
            workflow_version_id=version.id,
            execution_id=execution_id,
            workflow_data=resolved_workflow_data,
        )
    except ValueError as e:
        raise BadRequest(detail=str(e))

    return ApiResponse(success=True, message="Workflow run queued", data=execution_id)
