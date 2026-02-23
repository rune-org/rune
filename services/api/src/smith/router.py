import uuid

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from src.core.dependencies import require_password_changed
from src.db.models import User, Workflow
from src.smith.response import SSE_RESPONSES
from src.smith.schemas import ClearThreadResponse, GenerateWorkflowRequest
from src.smith.service import SmithAgentService
from src.workflow.dependencies import get_workflow_with_permission
from src.workflow.permissions import require_workflow_permission

router = APIRouter(prefix="/smith", tags=["Smith"])


def get_smith_service(request: Request) -> SmithAgentService:
    """Get SmithAgentService with agent and checkpointer from app state."""
    agent = request.app.state.smith_agent
    checkpointer = request.app.state.smith_checkpointer
    return SmithAgentService(agent, checkpointer=checkpointer)


def build_session_id(user_id: int, workflow_id: int | str) -> str:
    """Build session ID from user ID and workflow ID."""
    return f"{user_id}:{workflow_id}"


@router.post(
    "/{workflow_id}",
    response_class=StreamingResponse,
    responses=SSE_RESPONSES,
)
@require_workflow_permission("edit")
async def generate_workflow(
    workflow_id: int,
    payload: GenerateWorkflowRequest,
    workflow: Workflow = Depends(get_workflow_with_permission),
    current_user: User = Depends(require_password_changed),
    smith: SmithAgentService = Depends(get_smith_service),
) -> StreamingResponse:
    """
    Use Smith AI to generate/update a workflow from natural language.

    Returns a **Server-Sent Events (SSE)** stream with real-time agent responses
    including AI tokens, tool calls, tool results, and completion status.

    **Requires:** EDIT permission (OWNER or EDITOR)

    **Headers:**
    - `Accept: text/event-stream`

    **Session Persistence:**
    Conversations are persisted per user+workflow combination.
    The same workflow_id will maintain conversation history for 60 minutes of inactivity.

    **Event Types:**
    - `stream_start`: Stream has started
    - `token`: AI-generated text token
    - `tool_call`: Agent is calling a tool (e.g., create_node, create_edge)
    - `tool_result`: Result from a tool call
    - `workflow_state`: Final workflow structure with nodes and edges
    - `stream_end`: Stream has completed successfully
    - `error`: An error occurred during processing
    """
    session_id = build_session_id(current_user.id, workflow.id)

    # Extract existing workflow data to populate initial state
    existing_nodes = []
    existing_edges = []
    if workflow.workflow_data:
        existing_nodes = workflow.workflow_data.get("nodes", [])
        existing_edges = workflow.workflow_data.get("edges", [])

    return StreamingResponse(
        smith.stream_workflow(
            message=payload.prompt,
            session_id=session_id,
            existing_nodes=existing_nodes,
            existing_edges=existing_edges,
        ),
        media_type="text/event-stream",
    )


@router.post(
    "",
    response_class=StreamingResponse,
    responses=SSE_RESPONSES,
)
async def generate_new_workflow(
    payload: GenerateWorkflowRequest,
    current_user: User = Depends(require_password_changed),
    smith: SmithAgentService = Depends(get_smith_service),
) -> StreamingResponse:
    """
    Use Smith AI to generate a new workflow from natural language (without a workflow_id).

    Returns a **Server-Sent Events (SSE)** stream with real-time agent responses
    including AI tokens, tool calls, tool results, and completion status.

    **Headers:**
    - `Accept: text/event-stream`

    **Session Persistence:**
    Creates a new temporary session. The returned workflow structure can be
    saved to create a new workflow.

    **Event Types:**
    - `stream_start`: Stream has started
    - `token`: AI-generated text token
    - `tool_call`: Agent is calling a tool (e.g., create_node, create_edge)
    - `tool_result`: Result from a tool call
    - `workflow_state`: Final workflow structure with nodes and edges
    - `stream_end`: Stream has completed successfully
    - `error`: An error occurred during processing
    """
    # Generate a temporary session ID for this new workflow generation
    temp_workflow_id = str(uuid.uuid4())
    session_id = build_session_id(current_user.id, temp_workflow_id)

    return StreamingResponse(
        smith.stream_workflow(
            message=payload.prompt,
            session_id=session_id,
            existing_nodes=[],
            existing_edges=[],
        ),
        media_type="text/event-stream",
    )


@router.delete(
    "/{workflow_id}",
    summary="Clear Smith AI conversation history",
    response_model=ClearThreadResponse,
)
@require_workflow_permission("edit")
async def clear_thread(
    workflow_id: int,
    workflow: Workflow = Depends(get_workflow_with_permission),
    current_user: User = Depends(require_password_changed),
    smith: SmithAgentService = Depends(get_smith_service),
) -> ClearThreadResponse:
    """
    Clear the Smith AI conversation history for a workflow.

    This resets the AI agent's memory for the specified workflow,
    allowing the user to start a fresh conversation.

    **Requires:** EDIT permission (OWNER or EDITOR)

    Returns:
        - `success`: Whether the thread was cleared successfully
        - `message`: A confirmation message
    """
    session_id = build_session_id(current_user.id, workflow.id)

    success = await smith.clear_thread(session_id)

    return ClearThreadResponse(
        success=success,
        message=(
            "Smith AI conversation history cleared."
            if success
            else "Smith AI checkpointer not available."
        ),
    )
