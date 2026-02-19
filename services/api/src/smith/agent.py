from typing import NotRequired

from langchain.agents import AgentState, create_agent
from langchain_google_genai import ChatGoogleGenerativeAI

from src.core.config import get_settings
from src.smith.prompts import SYSTEM_PROMPT
from src.smith.tools import SMITH_TOOLS


class SmithAgentState(AgentState):
    """Extended agent state with workflow tracking."""

    workflow_nodes: NotRequired[list[dict]]
    workflow_edges: NotRequired[list[dict]]
    current_workflow_id: NotRequired[str]


def create_smith_model() -> ChatGoogleGenerativeAI:
    """Create the LLM model with settings from environment."""
    settings = get_settings()

    return ChatGoogleGenerativeAI(
        model=settings.smith_model,
        temperature=settings.smith_temperature,
        google_api_key=settings.google_api_key,
    )


def create_smith_agent(checkpointer=None):
    """
    Create a Smith agent with workflow state tracking.

    Args:
        checkpointer: Optional LangGraph checkpointer for persistence

    Returns:
        A LangGraph agent executor with workflow state tracking
    """
    model = create_smith_model()

    agent_executor = create_agent(
        model=model,
        tools=SMITH_TOOLS,
        system_prompt=SYSTEM_PROMPT,
        checkpointer=checkpointer,
        state_schema=SmithAgentState,
    )

    return agent_executor
