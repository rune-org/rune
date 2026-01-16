import json
import traceback
import uuid
from typing import AsyncGenerator

from langgraph.graph.state import CompiledStateGraph
from langchain_core.messages import AIMessageChunk, HumanMessage, ToolMessage
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver


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
        input_messages = {
            "messages": [HumanMessage(content=message)],
            "workflow_nodes": existing_nodes if existing_nodes is not None else [],
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
                        if event.content:
                            yield _format_sse(
                                {"type": "token", "content": event.content}
                            )

                        if (
                            hasattr(event, "tool_call_chunks")
                            and event.tool_call_chunks
                        ):
                            for call in event.tool_call_chunks:
                                if "name" in call and "args" in call:
                                    try:
                                        yield _format_sse(
                                            {
                                                "type": "tool_call",
                                                "name": call["name"],
                                                "arguments": call["args"],
                                                "call_id": call["id"],
                                            }
                                        )
                                    except json.JSONDecodeError as err:
                                        yield _format_sse(
                                            {
                                                "type": "error",
                                                "message": f"Invalid tool args: {str(err)}",
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

                    # Send workflow structure to update UI after each event
                    yield _format_sse(
                        {
                            "type": "workflow_state",
                            "workflow_nodes": workflow_nodes,
                            "workflow_edges": workflow_edges,
                        }
                    )

                except Exception as parse_err:
                    yield _format_sse(
                        {
                            "type": "warning",
                            "message": f"Parse error: {str(parse_err)}",
                        }
                    )
                    continue

            # End event after streaming is complete
            yield _format_sse({"type": "stream_end"})

        except Exception as err:
            trace = traceback.format_exc()
            print(f"Smith Agent Error:\n{trace}")
            yield _format_sse(
                {
                    "type": "error",
                    "message": f"Stream error: {str(err)}",
                }
            )
