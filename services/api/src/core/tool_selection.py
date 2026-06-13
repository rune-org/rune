"""LLM tool-selector middleware (Gemini-compatible).

A drop-in replacement for LangChain's ``LLMToolSelectorMiddleware`` that works
with Google Gemini. Built as a custom ``AgentMiddleware`` per the LangChain
custom-middleware guide (the class-based ``wrap_model_call`` pattern):
https://docs.langchain.com/oss/python/langchain/middleware/custom

Why we don't use the stock middleware
-------------------------------------
When an agent exposes many tools, a selector narrows them to the relevant few
before each model call. The stock ``LLMToolSelectorMiddleware`` encodes the valid
choices as a JSON-schema ``anyOf`` of ``{const: <name>, description: <desc>}``
branches. ``langchain-google-genai``'s schema converter collapses that to a bare
``{type: string}`` — it drops both the ``const`` enum and the descriptions — so
Gemini is never told the valid tool names and instead echoes back tool
*descriptions*. The stock middleware then rejects those with
``ValueError: Model selected invalid tools: [...]`` and the whole turn crashes.

What this version does differently
----------------------------------
* Encodes the choices as a single **flat** ``enum`` of tool names, which Gemini's
  converter preserves and the model is constrained to.
* Renders each tool's description into the selection prompt — the only place the
  model can learn what a tool does, since a flat enum carries names only.
* Never hard-fails the turn: unknown selections are dropped with a warning, and a
  selector error (network/parse) falls back to passing through all tools.

Config knobs (constructor): ``model`` (selector model override), ``max_tools``
(cap on selected tools), ``must_select_tools`` (always included, not counted
against ``max_tools``), and ``system_prompt`` (the selection prompt).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from langchain.agents.middleware import AgentMiddleware, ModelRequest, ModelResponse
from langchain.chat_models.base import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from langchain_core.tools import BaseTool

logger = logging.getLogger(__name__)

DEFAULT_SELECTOR_PROMPT = (
    "You are a tool router. Your sole job is to select, from the list provided, "
    "the tools needed to handle the user's request. Choose only tools that are "
    "clearly relevant; if none apply, return an empty list."
)


class ToolSelectorMiddleware(AgentMiddleware):
    """Use an LLM to pick the relevant subset of tools before each model call.

    Designed to be provider-robust (in particular, correct on Google Gemini,
    where the stock ``LLMToolSelectorMiddleware`` mis-encodes the choices). The
    selectable tools are presented to a selector model as a flat enum of names
    plus a rendered description catalog; the model returns the names it needs,
    which are appended to the always-included ``must_select_tools``.
    """

    def __init__(
        self,
        *,
        model: str | BaseChatModel | None = None,
        system_prompt: str = DEFAULT_SELECTOR_PROMPT,
        max_tools: int | None = None,
        must_select_tools: list[str] | None = None,
    ) -> None:
        """Initialize the selector.

        Args:
            model: Model used for selection. If omitted, the agent's main model
                is used. May be a model-identifier string or a ``BaseChatModel``.
            system_prompt: The selection prompt shown to the selector model. The
                tool catalog and (when set) the ``max_tools`` hint are appended.
            max_tools: Maximum number of tools to select. Extra selections beyond
                this are dropped. ``None`` means no limit.
            must_select_tools: Tool names that are always included regardless of
                selection. These do not count against ``max_tools``.
        """
        super().__init__()
        self.system_prompt = system_prompt
        self.max_tools = max_tools
        self.must_select_tools = must_select_tools or []

        if isinstance(model, (BaseChatModel, type(None))):
            self.model: BaseChatModel | None = model
        else:
            self.model = init_chat_model(model)

    # ── helpers (no IO) ──────────────────────────────────────────────────────

    def _partition_tools(
        self, request: ModelRequest
    ) -> tuple[list[BaseTool], list[BaseTool], list[dict]]:
        """Split request tools into (selectable, must-include, provider dicts)."""
        tools = request.tools or []
        base_tools = [t for t in tools if not isinstance(t, dict)]
        provider_tools = [t for t in tools if isinstance(t, dict)]
        must = [t for t in base_tools if t.name in self.must_select_tools]
        selectable = [t for t in base_tools if t.name not in self.must_select_tools]
        return selectable, must, provider_tools

    def _selection_schema(self, selectable: list[BaseTool]) -> dict[str, Any]:
        """JSON schema with a flat string ``enum`` of tool names (Gemini-safe)."""
        return {
            "type": "object",
            "properties": {
                "tools": {
                    "type": "array",
                    "description": "Names of the tools needed for this request, most relevant first.",
                    "items": {
                        "type": "string",
                        "enum": [t.name for t in selectable],
                    },
                }
            },
            "required": ["tools"],
        }

    def _selection_messages(
        self, request: ModelRequest, selectable: list[BaseTool]
    ) -> list[Any]:
        """Build the [system, last-user] messages for the selector model.

        Only ``selectable`` tools are rendered into the catalog (and only their
        names go into the schema enum). The always-included ``must_select_tools``
        are deliberately withheld from the selector so it can't be confused into
        "choosing" a tool that is already present unconditionally.
        """
        catalog = "\n".join(f"- {t.name}: {t.description}" for t in selectable)
        system = self.system_prompt
        # Phrasing mirrors LangChain's stock selector: spell out that ordering
        # matters because only the first ``max_tools`` survive — it nudges the
        # model to front-load the most relevant tools rather than pad the list.
        if self.max_tools is not None:
            system += (
                f"\n\nIMPORTANT: List the tool names in order of relevance, most "
                f"relevant first. If you select more than {self.max_tools}, only "
                f"the first {self.max_tools} will be used."
            )
        system += "\n\nAvailable tools:\n" + catalog

        last_user: HumanMessage | None = None
        for message in reversed(request.messages):
            if isinstance(message, HumanMessage):
                last_user = message
                break

        return [
            {"role": "system", "content": system},
            last_user if last_user is not None else HumanMessage(content=""),
        ]

    def _selector_model(self, request: ModelRequest) -> BaseChatModel:
        return self.model or request.model

    def _apply_selection(
        self,
        response: dict[str, Any],
        request: ModelRequest,
        selectable: list[BaseTool],
        must: list[BaseTool],
        provider_tools: list[dict],
    ) -> ModelRequest:
        """Resolve the selector response into a filtered ``ModelRequest``."""
        valid = {t.name for t in selectable}
        chosen: list[str] = []
        invalid: list[str] = []
        for name in response.get("tools", []) or []:
            if name not in valid:
                invalid.append(name)
                continue
            if name in chosen:
                continue
            if self.max_tools is None or len(chosen) < self.max_tools:
                chosen.append(name)

        if invalid:
            logger.warning(
                "Tool selector returned unknown tools (ignored): %s", invalid
            )

        selected = [t for t in selectable if t.name in chosen]
        return request.override(tools=[*selected, *must, *provider_tools])

    # ── middleware hooks ─────────────────────────────────────────────────────

    def wrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse],
    ) -> ModelResponse:
        """Filter tools via LLM selection, then invoke the model (sync)."""
        selectable, must, provider_tools = self._partition_tools(request)
        if not selectable:
            return handler(request)

        model = self._selector_model(request).with_structured_output(
            self._selection_schema(selectable)
        )
        try:
            response = model.invoke(self._selection_messages(request, selectable))
        except Exception:
            logger.exception("Tool selection failed; passing through all tools")
            return handler(request)

        if not isinstance(response, dict):
            logger.warning(
                "Tool selector returned %s, not a dict; passing through all tools",
                type(response).__name__,
            )
            return handler(request)

        return handler(
            self._apply_selection(response, request, selectable, must, provider_tools)
        )

    async def awrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], Awaitable[ModelResponse]],
    ) -> ModelResponse:
        """Filter tools via LLM selection, then invoke the model (async)."""
        selectable, must, provider_tools = self._partition_tools(request)
        if not selectable:
            return await handler(request)

        model = self._selector_model(request).with_structured_output(
            self._selection_schema(selectable)
        )
        try:
            response = await model.ainvoke(
                self._selection_messages(request, selectable)
            )
        except Exception:
            logger.exception("Tool selection failed; passing through all tools")
            return await handler(request)

        if not isinstance(response, dict):
            logger.warning(
                "Tool selector returned %s, not a dict; passing through all tools",
                type(response).__name__,
            )
            return await handler(request)

        return await handler(
            self._apply_selection(response, request, selectable, must, provider_tools)
        )
