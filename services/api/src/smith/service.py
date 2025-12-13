"""Smith AI Agent Service - LangChain-based workflow generator with Redis checkpointing."""

import json
import traceback
import uuid
from typing import AsyncGenerator

from langchain_core.messages import AIMessageChunk, HumanMessage, ToolMessage
from langgraph.checkpoint.redis.ashallow import AsyncShallowRedisSaver

from src.core.config import get_settings
from src.smith.agent import create_smith_agent


# This config ensures:
# 1. Writes (updates) WILL reset the clock to 60 mins.
# 2. Reads (viewing history) WILL NOT reset the clock.
TTL_CONFIG = {"default_ttl": 60, "refresh_on_read": False}


def _build_redis_url() -> str:
    """Build Redis URL for checkpointer using DB 2."""
    settings = get_settings()
    host = settings.redis_host
    port = settings.redis_port
    password = settings.redis_password

    if password:
        return f"redis://:{password}@{host}:{port}/2"
    return f"redis://{host}:{port}/2"


# Module-level checkpointer and agent (shared across requests)
_checkpointer: AsyncShallowRedisSaver | None = None
_agent = None


async def setup_smith() -> None:
    """
    Initialize the Redis checkpointer and agent at startup.

    The asetup() call is idempotent - safe to call on every server restart.
    It creates required Redis indices if they don't exist.
    """
    global _checkpointer, _agent

    redis_url = _build_redis_url()
    _checkpointer = AsyncShallowRedisSaver.from_conn_string(redis_url, ttl=TTL_CONFIG)

    # Idempotent - creates indices if they don't exist
    await _checkpointer.asetup()

    _agent = create_smith_agent(checkpointer=_checkpointer)


def _format_sse(payload: dict) -> str:
    """Format payload as an SSE event."""
    return f"data: {json.dumps(payload)}\n\n"


class SmithAgentService:
    """
    Service layer for the Smith AI workflow builder.

    Uses LangGraph with AsyncShallowRedisSaver for checkpointing and TTL support.
    Checkpointer is initialized once at startup via setup_smith().
    """

    def _get_agent(self):
        """Get the Smith agent (must call setup_smith first)."""
        if _agent is None:
            raise RuntimeError("Smith not initialized. Call setup_smith() at startup.")
        return _agent

    async def stream_workflow(
        self,
        message: str,
        session_id: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream SSE events from the Smith agent.

        Args:
            message: The user's natural language request
            session_id: Session ID for conversation persistence (user_id:workflow_id)

        Yields:
            SSE-formatted events (data: {...}\n\n)
        """
        agent = self._get_agent()
        session_id = session_id or str(uuid.uuid4())

        config = {
            "configurable": {
                "thread_id": session_id,
            }
        }

        yield _format_sse({"type": "stream_start"})

        input_messages = {"messages": [HumanMessage(content=message)]}

        try:
            async for event, _ in agent.astream(
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
                        yield _format_sse(
                            {
                                "type": "tool_result",
                                "output": event.content,
                                "call_id": event.tool_call_id,
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

            # End event
            yield _format_sse({"type": "stream_end"})

        except Exception as err:
            trace = traceback.format_exc()
            yield _format_sse(
                {
                    "type": "error",
                    "message": f"Stream error: {str(err)}",
                    "trace": trace[:500],
                }
            )
