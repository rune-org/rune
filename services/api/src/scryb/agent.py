"""Scryb documentation agent.

Scryb generates Markdown documentation for a workflow from its SIR. It is a small
agent (LangChain ``create_agent``) whose only tools read the per-node docs that
Smith also uses: ``read_node_doc`` plus the prebuilt ``glob_search``/``grep_search``
from ``FilesystemFileSearchMiddleware``. Reading the docs on demand replaces the
old hardcoded "Node Type Reference" in the prompt, which had drifted from the DSL.

The agent is stateless (one doc per request), so it needs no checkpointer, no
todo/planning middleware, and no tool selector (the tool set is tiny).
"""

from langchain.agents import create_agent
from langchain.agents.middleware import FilesystemFileSearchMiddleware

from src.core.config import get_settings
from src.core.llm import build_google_chat_model
from src.scryb.prompts import SCRYB_BASE_PROMPT
from src.smith.docs import NODE_DOCS_DIR, build_node_type_index, read_node_doc


def create_scryb_agent():
    """Build the Scryb documentation agent.

    The system prompt is request-independent (task + format rules + node-doc
    instructions + the node-type index); the per-request style directive and the
    workflow SIR travel in the human message (see ``ScrybService.generate_docs``).

    Returns:
        A compiled LangGraph agent that reads node docs on demand and emits the
        final Markdown documentation as its last message.
    """
    settings = get_settings()
    model = build_google_chat_model(settings.scryb_model, settings.scryb_temperature)

    system_prompt = SCRYB_BASE_PROMPT + "\n\n" + build_node_type_index()

    # glob_search + grep_search over the shared node_docs; read_node_doc reads the
    # full file. ripgrep is used when present, with a Python fallback.
    doc_search = FilesystemFileSearchMiddleware(root_path=str(NODE_DOCS_DIR))

    return create_agent(
        model=model,
        tools=[read_node_doc],
        system_prompt=system_prompt,
        middleware=[doc_search],
    )
