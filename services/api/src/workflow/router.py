from fastapi import APIRouter, Depends, Response, status

from src.core.dependencies import (
    require_password_changed,
)
from src.core.exceptions import BadRequest, NotFound
from src.core.responses import ApiResponse
from src.db.models import User, Workflow
from src.executions.service import ExecutionTokenService
from src.workflow.dependencies import (
    get_workflow_with_permission,
    get_queue_service,
    get_token_service,
    get_workflow_service,
)
from src.workflow.permissions import require_workflow_permission
from src.workflow.policy import WorkflowPolicy
from src.workflow.queue import WorkflowQueueService
from src.workflow.schemas import (
    BulkOperationResult,
    BulkOperationSummary,
    BulkWorkflowAction,
    BulkWorkflowFailure,
    BulkWorkflowRequest,
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


# ---------------------------------------------------------------------------
# Mapping: bulk action → WorkflowPolicy checker method
# ---------------------------------------------------------------------------

_BULK_ACTION_POLICY: dict[BulkWorkflowAction, str] = {
    BulkWorkflowAction.DELETE: "can_delete",
    BulkWorkflowAction.ACTIVATE: "can_edit",
    BulkWorkflowAction.DEACTIVATE: "can_edit",
    BulkWorkflowAction.EXPORT: "can_view",
    BulkWorkflowAction.RUN: "can_execute",
}


@router.post("/bulk", response_model=ApiResponse[BulkOperationResult])
async def bulk_workflow_operation(
    payload: BulkWorkflowRequest,
    current_user: User = Depends(require_password_changed),
    service: WorkflowService = Depends(get_workflow_service),
    queue_service: WorkflowQueueService = Depends(get_queue_service),
    token_service: ExecutionTokenService = Depends(get_token_service),
) -> ApiResponse[BulkOperationResult]:
    """
    Apply a single action to multiple workflows in one request.

    Each workflow is evaluated individually against the caller's per-workflow role.

    - `delete`, `activate`, `deactivate`, `run` return JSON summary payloads.
    - `export` returns a ZIP archive (`application/zip`) of sanitized workflow JSONs.

    **Actions and minimum required role:**

    | action     | required role          |
    |------------|------------------------|
    | delete     | OWNER                  |
    | activate   | OWNER or EDITOR        |
    | deactivate | OWNER or EDITOR        |
    | export     | OWNER, EDITOR, VIEWER  |
    | run        | OWNER or EDITOR        |

    **Failure reasons:**

    - `not_found`        — the workflow ID does not exist
    - `forbidden`        — the caller lacks the required role
    - `invalid_workflow` — workflow structure is invalid for execution (`run` only)
    """
    policy_method_name = _BULK_ACTION_POLICY[payload.action]

    # Single bulk DB round-trip: fetch all requested workflows + per-user roles.
    fetched = await service.bulk_fetch_with_roles(current_user.id, payload.workflow_ids)

    succeeded: list[int] = []
    failed: list[BulkWorkflowFailure] = []
    permitted_workflows: list[Workflow] = []
    executions: dict[
        int, str
    ] = {}  # workflow_id -> execution_id (populated only for RUN action)

    for wf_id in payload.workflow_ids:
        if wf_id not in fetched:
            failed.append(BulkWorkflowFailure(id=wf_id, reason="not_found"))
            continue

        wf, role = fetched[wf_id]
        can_act: bool = getattr(WorkflowPolicy, policy_method_name)(current_user, role)
        if not can_act:
            failed.append(BulkWorkflowFailure(id=wf_id, reason="forbidden"))
            continue

        permitted_workflows.append(wf)

    # ---- Execute the action on all permitted workflows ----

    if payload.action == BulkWorkflowAction.DELETE:
        await service.bulk_delete_many(permitted_workflows)
        succeeded = [wf.id for wf in permitted_workflows]

    elif payload.action == BulkWorkflowAction.ACTIVATE:
        await service.bulk_set_status(permitted_workflows, is_active=True)
        succeeded = [wf.id for wf in permitted_workflows]

    elif payload.action == BulkWorkflowAction.DEACTIVATE:
        await service.bulk_set_status(permitted_workflows, is_active=False)
        succeeded = [wf.id for wf in permitted_workflows]

    elif payload.action == BulkWorkflowAction.EXPORT:
        if not permitted_workflows:
            raise NotFound(detail="No exportable workflows found")

        archive_bytes, file_name = await service.build_bulk_export_response(
            payload.workflow_ids, permitted_workflows
        )
        return Response(
            content=archive_bytes,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
        )

    elif payload.action == BulkWorkflowAction.RUN:
        # Handle each workflow individually — each needs its own execution record,
        # token publish, and queue publish. Any may fail due to invalid structure.
        for wf in permitted_workflows:
            try:
                execution_id = await service.queue_workflow_execution(
                    workflow=wf,
                    user_id=current_user.id,
                    queue_service=queue_service,
                    token_service=token_service,
                )
                succeeded.append(wf.id)
                executions[wf.id] = execution_id
            except ValueError:
                failed.append(BulkWorkflowFailure(id=wf.id, reason="invalid_workflow"))

    summary = BulkOperationSummary(
        total=len(payload.workflow_ids),
        succeeded=len(succeeded),
        failed=len(failed),
    )
    result = BulkOperationResult(
        action=payload.action.value,
        succeeded=succeeded,
        failed=failed,
        summary=summary,
        executions=executions if payload.action == BulkWorkflowAction.RUN else None,
    )
    return ApiResponse(success=True, message="Bulk operation completed", data=result)


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
    try:
        execution_id = await workflow_service.queue_workflow_execution(
            workflow=workflow,
            user_id=current_user.id,
            queue_service=queue_service,
            token_service=token_service,
            version_id=payload.version_id if payload else None,
        )
    except ValueError as e:
        raise BadRequest(detail=str(e))

    return ApiResponse(success=True, message="Workflow run queued", data=execution_id)
