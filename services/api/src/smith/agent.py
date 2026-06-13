from typing import NotRequired

from langchain.agents import AgentState, create_agent
from langchain.agents.middleware import (
    FilesystemFileSearchMiddleware,
    TodoListMiddleware,
)
from langchain_google_genai import ChatGoogleGenerativeAI

from src.core.config import get_settings
from src.core.llm import build_google_chat_model
from src.core.tool_selection import ToolSelectorMiddleware
from src.smith.docs import NODE_DOCS_DIR, build_node_type_index, read_node_doc
from src.smith.prompts import BASE_SYSTEM_PROMPT, TOOL_SELECTOR_PROMPT
from src.smith.tools import (
    SMITH_TOOLS,
    create_edge,
    delete_edge,
    delete_node,
    list_workflow_edges,
    list_workflow_nodes,
    update_node,
)


class SmithAgentState(AgentState):
    """Extended agent state with workflow tracking.

    ``todos`` is intentionally not declared here: it is owned by
    ``TodoListMiddleware`` (its ``PlanningState`` contributes the channel), so
    the prebuilt ``write_todos`` tool and its state stay the single source.
    """

    workflow_nodes: NotRequired[list[dict]]
    workflow_edges: NotRequired[list[dict]]
    current_workflow_id: NotRequired[str]


# Tools the LLM tool selector must never filter out: structural graph edits,
# discovery, and on-demand docs. These are needed on (almost) every turn
# regardless of the specific request, and do not count against the selector's
# ``max_tools`` budget. Derived by ``.name`` so nothing is hardcoded. The
# prebuilt planning (``write_todos``) and doc-search (``glob_search``,
# ``grep_search``) tools are added to the always-include set in
# ``create_smith_agent`` since they come from middleware, not ``SMITH_TOOLS``.
_ALWAYS_INCLUDE_TOOLS = [
    update_node,
    delete_node,
    create_edge,
    delete_edge,
    list_workflow_nodes,
    list_workflow_edges,
    read_node_doc,
]
ALWAYS_INCLUDE = [t.name for t in _ALWAYS_INCLUDE_TOOLS]


def create_smith_model() -> ChatGoogleGenerativeAI:
    """Create the Gemini chat model (Google AI Studio or Vertex AI per config)."""
    settings = get_settings()
    return build_google_chat_model(settings.smith_model, settings.smith_temperature)


def create_smith_agent(checkpointer=None, extra_tools=None):
    """
    Create a Smith agent with workflow state tracking.

    Args:
        checkpointer: Optional LangGraph checkpointer for persistence.
        extra_tools: Optional extra tools (e.g. Context7 MCP tools) added to the
            selectable pool. They are not in the always-include set, so the tool
            selector decides when to surface them.

    Returns:
        A LangGraph agent executor with workflow state tracking.
    """
    model = create_smith_model()

    # Compose the slim system prompt once. The node-type index is
    # request-independent, so there is no need for dynamic_prompt middleware.
    system_prompt = BASE_SYSTEM_PROMPT + "\n\n" + build_node_type_index()

    tools = SMITH_TOOLS + [read_node_doc] + list(extra_tools or [])

    # Prebuilt planning: ``write_todos`` (state + tool + guidance prompt) instead
    # of hand-rolled plan tools. Prebuilt doc search: ``glob_search`` +
    # ``grep_search`` scoped to ``node_docs/`` so the agent can list/search the
    # per-node docs and then ``read_node_doc`` the full file — rather than only
    # opening one doc by exact name. Both contribute their own tools.
    todo_middleware = TodoListMiddleware()
    doc_search = FilesystemFileSearchMiddleware(root_path=str(NODE_DOCS_DIR))

    # Force-include the middleware-provided tools so the selector never hides
    # planning or doc discovery. Names are read off the middleware (``.name``)
    # so nothing is hardcoded.
    middleware_always_include = [t.name for t in todo_middleware.tools] + [
        t.name for t in doc_search.tools
    ]

    # Smith exposes ~47 tools (most irrelevant per request). Our custom
    # ``ToolSelectorMiddleware`` narrows them to the relevant few per turn, on top
    # of the always-include (``must_select_tools``) set. It replaces LangChain's
    # stock ``LLMToolSelectorMiddleware``, whose ``anyOf``/``const`` selection
    # schema Gemini mis-handles (it returns tool descriptions instead of names and
    # the turn crashes). Selection uses the agent's main model (``model`` omitted)
    # and a Smith-specific prompt. It runs via a non-streaming ``ainvoke``, so its
    # output never leaks into the token SSE stream.
    tool_selector = ToolSelectorMiddleware(
        max_tools=10,
        must_select_tools=ALWAYS_INCLUDE + middleware_always_include,
        system_prompt=TOOL_SELECTOR_PROMPT,
    )

    agent_executor = create_agent(
        model=model,
        tools=tools,
        system_prompt=system_prompt,
        checkpointer=checkpointer,
        state_schema=SmithAgentState,
        middleware=[todo_middleware, doc_search, tool_selector],
    )

    return agent_executor
