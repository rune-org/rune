import json
import logging
import uuid
from typing import AsyncGenerator

from langchain_core.messages import AIMessageChunk, HumanMessage, ToolMessage
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph.state import CompiledStateGraph

from src.smith.docs import DSL_TO_CANONICAL_NODE_TYPE as _DSL_TO_CANVAS_TYPE


logger = logging.getLogger(__name__)


def _normalize_node_types(nodes: list[dict]) -> list[dict]:
    """Convert DSL type names to canvas type names for agent state consistency."""
    normalized = []
    for node in nodes:
        node_type = node.get("type", "")
        if node_type in _DSL_TO_CANVAS_TYPE:
            node = {**node, "type": _DSL_TO_CANVAS_TYPE[node_type]}
        if node["type"] in ("trigger", "scheduledTrigger", "webhookTrigger"):
            node = {**node, "trigger": True}
        normalized.append(node)
    return normalized


def _to_ui_todos(todos: list[dict]) -> list[dict]:
    """Adapt prebuilt ``write_todos`` items to the UI's ``TodoItem`` shape.

    ``TodoListMiddleware`` stores todos as ``{content, status}`` with status in
    ``{pending, in_progress, completed}``. The Smith chat panel expects
    ``{id, title, status}`` with status in ``{pending, in_progress, done}``, so
    map ``content -> title``, ``completed -> done``, and synthesize a stable
    list-position id (``write_todos`` replaces the whole list each call, so the
    index is a stable key within a render).
    """
    return [
        {
            "id": str(index),
            "title": todo.get("content", ""),
            "status": "done" if todo.get("status") == "completed" else todo.get("status", "pending"),
        }
        for index, todo in enumerate(todos)
    ]


class SmithAgentService:
    """
    Service layer for the Smith AI workflow builder.

    Uses LangGraph with AsyncPostgresSaver for checkpointing.
    Agent is passed in from app.state (initialized at startup).
    """

    def __init__(self, agent, checkpointer=None):
        """
        Initialize the service with a Smith agent.

        Args:
            agent: The LangGraph agent from app.state.smith_agent
            checkpointer: Optional PostgreSQL checkpointer for thread management
        """
        self._agent: CompiledStateGraph = agent
        self._checkpointer: AsyncPostgresSaver = checkpointer

    async def clear_thread(self, session_id: str) -> bool:
        """
        Clear all checkpoints for a given session/thread.

        Args:
            session_id: The session ID (thread_id) to clear

        Returns:
            True if successful, False if checkpointer is not available
        """
        if self._checkpointer is None:
            return False

        await self._checkpointer.adelete_thread(session_id)
        return True

    async def stream_workflow(
        self,
        message: str,
        session_id: str | None = None,
        existing_nodes: list | None = None,
        existing_edges: list | None = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream SSE events from the Smith agent.

        Args:
            message: The user's natural language request
            session_id: Session ID for conversation persistence (user_id:workflow_id)
            existing_nodes: Existing workflow nodes to populate state (from workflow_data)
            existing_edges: Existing workflow edges to populate state (from workflow_data)

        Yields:
            SSE-formatted events (data: {...}\n\n)
        """

        def _format_sse(payload: dict) -> str:
            """Format payload as an SSE event."""
            return f"data: {json.dumps(payload)}\n\n"

        session_id = session_id or str(uuid.uuid4())

        config = {
            "configurable": {
                "thread_id": session_id,
            }
        }

        yield _format_sse({"type": "stream_start"})

        # Initialize workflow state with existing data or empty arrays
        # Normalize legacy DSL type names so the agent sees consistent canvas types
        normalized_nodes = _normalize_node_types(existing_nodes) if existing_nodes else []
        # ``todos`` is owned by TodoListMiddleware and defaults to empty, so it
        # is not seeded here.
        input_messages = {
            "messages": [HumanMessage(content=message)],
            "workflow_nodes": normalized_nodes,
            "workflow_edges": existing_edges if existing_edges is not None else [],
        }

        try:
            async for event, _ in self._agent.astream(
                input_messages,
                config=config,
                stream_mode="messages",
            ):
                try:
                    if isinstance(event, AIMessageChunk):
                        # Stream the visible answer token-by-token. When thinking
                        # is enabled Gemini interleaves "reasoning" content blocks
                        # with "text" ones; emit only the text so reasoning stays
                        # hidden from the chat. (Forwarding the raw block list would
                        # also make the browser render each block as
                        # "[object Object]".)
                        text = "".join(
                            block.get("text", "")
                            for block in event.content_blocks
                            if block.get("type") == "text"
                        )
                        if text:
                            yield _format_sse({"type": "token", "content": text})

                        if (
                            hasattr(event, "tool_call_chunks")
                            and event.tool_call_chunks
                        ):
                            for call in event.tool_call_chunks:
                                # Only the opening chunk of a tool call carries a
                                # name; nameless continuation fragments would emit
                                # a stray "tool:" line, so skip them.
                                name = call.get("name")
                                if not name:
                                    continue
                                yield _format_sse(
                                    {
                                        "type": "tool_call",
                                        "name": name,
                                        "arguments": call.get("args") or "",
                                        "call_id": call.get("id"),
                                    }
                                )

                    elif isinstance(event, ToolMessage):
                        # Parse tool output to extract node/edge objects
                        output = {}
                        try:
                            parsed = json.loads(event.content)
                            if "node" in parsed:
                                output["node"] = parsed["node"]
                            if "edge" in parsed:
                                output["edge"] = parsed["edge"]
                        except (json.JSONDecodeError, TypeError):
                            output = event.content

                        yield _format_sse(
                            {
                                "type": "tool_result",
                                "output": output,
                                "call_id": event.tool_call_id,
                            }
                        )

                    # Get current state to extract workflow structure
                    current_state = await self._agent.aget_state(config)
                    workflow_nodes = current_state.values.get("workflow_nodes", [])
                    workflow_edges = current_state.values.get("workflow_edges", [])
                    todos = current_state.values.get("todos", [])

                    # Send workflow structure to update UI after each event
                    yield _format_sse(
                        {
                            "type": "workflow_state",
                            "workflow_nodes": workflow_nodes,
                            "workflow_edges": workflow_edges,
                            "todos": _to_ui_todos(todos),
                        }
                    )

                except Exception:
                    logger.exception("Failed to process Smith stream event")
                    yield _format_sse(
                        {
                            "type": "warning",
                            "message": "Failed to process part of the Smith stream.",
                        }
                    )
                    continue

            # End event after streaming is complete
            yield _format_sse({"type": "stream_end"})

        except Exception:
            logger.exception("Smith stream failed")
            yield _format_sse(
                {
                    "type": "error",
                    "message": "An internal error occurred while streaming the workflow.",
                }
            )
