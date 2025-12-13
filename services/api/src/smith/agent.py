"""Smith AI Agent using LangChain/LangGraph with Redis checkpointer."""

from langchain.agents import create_agent
from langchain_google_genai import ChatGoogleGenerativeAI

from src.core.config import get_settings
from src.smith.prompts import SYSTEM_PROMPT
from src.smith.tools import SMITH_TOOLS


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
    Create a Smith agent with optional checkpointer.

    Args:
        checkpointer: Optional LangGraph checkpointer for persistence

    Returns:
        A LangGraph agent executor
    """
    model = create_smith_model()

    agent_executor = create_agent(
        model=model,
        tools=SMITH_TOOLS,
        prompt=SYSTEM_PROMPT,
        checkpointer=checkpointer,
    )

    return agent_executor
