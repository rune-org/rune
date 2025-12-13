from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from src.core.dependencies import require_password_changed
from src.db.models import User, Workflow
from src.smith.docs import SSE_RESPONSE_DESCRIPTION
from src.smith.schemas import GenerateWorkflowRequest
from src.smith.service import SmithAgentService
from src.workflow.dependencies import get_workflow_with_permission
from src.workflow.permissions import require_workflow_permission


router = APIRouter(prefix="/workflows", tags=["Workflows"])


def get_smith_service() -> SmithAgentService:
    return SmithAgentService()


def build_session_id(user_id: int, workflow_id: int) -> str:
    """Build session ID from user ID and workflow ID."""
    return f"{user_id}:{workflow_id}"


@router.post(
    "/{workflow_id}/smith/generate",
    response_class=StreamingResponse,
    responses={
        200: {
            "description": SSE_RESPONSE_DESCRIPTION,
            "content": {"text/event-stream": {}},
        }
    },
)
@require_workflow_permission("edit")
async def generate_workflow(
    payload: GenerateWorkflowRequest,
    workflow: Workflow = Depends(get_workflow_with_permission),
    current_user: User = Depends(require_password_changed),
    smith: SmithAgentService = Depends(get_smith_service),
) -> StreamingResponse:
    """
    Use Smith AI to generate a workflow from natural language.

    Returns a **Server-Sent Events (SSE)** stream with real-time agent responses
    including AI tokens, tool calls, tool results, and completion status.

    **Requires:** EDIT permission (OWNER or EDITOR)

    **Headers:**
    - `Accept: text/event-stream`

    **Session Persistence:**
    Conversations are persisted per user+workflow combination.
    The same workflow_id will maintain conversation history for 60 minutes of inactivity.
    """
    session_id = build_session_id(current_user.id, workflow.id)

    return StreamingResponse(
        smith.stream_workflow(
            message=payload.prompt,
            session_id=session_id,
        ),
        media_type="text/event-stream",
    )
