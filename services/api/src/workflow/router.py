import uuid

from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import JSONResponse

from src.core.config import get_settings
from src.core.dependencies import (
    DatabaseDep,
    require_password_changed,
)
from src.core.exceptions import BadRequest, NotFound
from src.core.responses import ApiResponse
from src.db.models import User, Workflow, WorkflowVersion
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
    WorkflowVersionConflict,
    WorkflowVersionCreator,
    WorkflowVersionDetail,
    WorkflowVersionListItem,
)
from src.workflow.service import WorkflowService, WorkflowVersionConflictError

router = APIRouter(prefix="/workflows", tags=["Workflows"])


def get_workflow_service(db: DatabaseDep) -> WorkflowService:
    return WorkflowService(db=db)


def get_queue_service(connection=Depends(get_rabbitmq)) -> WorkflowQueueService:
    return WorkflowQueueService(
        connection=connection, queue_name=get_settings().rabbitmq_workflow_queue
    )


def get_token_service(connection=Depends(get_rabbitmq)) -> ExecutionTokenService:
    return ExecutionTokenService(
        connection=connection, queue_name=get_settings().rabbitmq_token_queue
    )


def serialize_version(
    version: WorkflowVersion,
    published_version_id: int | None,
    creator: User | None = None,
    *,
    include_data: bool,
) -> WorkflowVersionListItem | WorkflowVersionDetail:
    payload = {
        "id": version.id,
        "version": version.version,
        "created_at": version.created_at,
        "created_by": (
            WorkflowVersionCreator(id=creator.id, name=creator.name) if creator else None
        ),
        "message": version.message,
        "is_published": version.id == published_version_id,
    }
    if include_data:
        return WorkflowVersionDetail(**payload, workflow_data=version.workflow_data)
    return WorkflowVersionListItem(**payload)


def serialize_workflow_detail(
    workflow: Workflow,
    latest_version: tuple[WorkflowVersion, User | None] | None,
) -> WorkflowDetail:
    latest_version_payload = None
    if latest_version is not None:
        version, creator = latest_version
        latest_version_payload = serialize_version(
            version,
            workflow.published_version_id,
            creator,
            include_data=True,
        )

    return WorkflowDetail(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        is_active=workflow.is_active,
        latest_version=latest_version_payload,
        published_version_id=workflow.published_version_id,
        has_unpublished_changes=(
            workflow.latest_version_id is not None
            and workflow.latest_version_id != workflow.published_version_id
        ),
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
    )


def version_conflict_response(exc: WorkflowVersionConflictError) -> JSONResponse:
    payload = ApiResponse[WorkflowVersionConflict](
        success=False,
        message="version_conflict",
        data=WorkflowVersionConflict(
            server_version=exc.server_version,
            server_version_id=exc.server_version_id,
        ),
    )
    return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=payload.model_dump())


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
    detail = serialize_workflow_detail(
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
    detail = serialize_workflow_detail(wf, None)
    return ApiResponse(success=True, message="Workflow created", data=detail)


@router.put("/{workflow_id}/name", response_model=ApiResponse[WorkflowDetail])
@require_workflow_permission("edit")
async def update_name(
    payload: WorkflowUpdateName,
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: WorkflowService = Depends(get_workflow_service),
) -> ApiResponse[WorkflowDetail]:
    wf = await service.update_name(workflow, payload.name)
    detail = serialize_workflow_detail(
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
        serialize_version(
            version,
            workflow.published_version_id,
            creator,
            include_data=False,
        )
        for version, creator in await service.list_versions(workflow.id)
    ]
    return ApiResponse(success=True, message="Workflow versions retrieved", data=versions)


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
    detail = serialize_version(
        version,
        workflow.published_version_id,
        creator,
        include_data=True,
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
        return version_conflict_response(exc)

    detail_tuple = await service.get_version_with_creator(workflow.id, version.id)
    version_detail = serialize_version(
        detail_tuple[0],
        workflow.published_version_id,
        detail_tuple[1],
        include_data=True,
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
    detail = serialize_workflow_detail(
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
    detail = serialize_version(
        detail_tuple[0],
        workflow.published_version_id,
        detail_tuple[1],
        include_data=True,
    )
    return ApiResponse(success=True, message="Workflow version restored", data=detail)


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_workflow_permission("delete")
async def delete_workflow(
    workflow: Workflow = Depends(get_workflow_with_permission),
    service: WorkflowService = Depends(get_workflow_service),
) -> None:
    await service.delete(workflow)
    return


@router.post("/{workflow_id}/run", response_model=ApiResponse[str])
@require_workflow_permission("execute")
async def run_workflow(
    payload: WorkflowRunRequest | None = None,
    workflow: Workflow = Depends(get_workflow_with_permission),
    current_user: User = Depends(require_password_changed),
    workflow_service: WorkflowService = Depends(get_workflow_service),
    queue_service: WorkflowQueueService = Depends(get_queue_service),
    token_service: ExecutionTokenService = Depends(get_token_service),
) -> ApiResponse[str]:
    version = await workflow_service.get_run_version(
        workflow, payload.version_id if payload else None
    )
    resolved_workflow_data = await workflow_service.resolve_workflow_credentials(
        version.workflow_data
    )
    execution_id = str(uuid.uuid4())

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
