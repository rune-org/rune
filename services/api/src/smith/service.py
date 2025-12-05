import json
import os
import re
from typing import Any, Iterable

import dspy
from dotenv import load_dotenv

from src.smith.agent import SmithAgent
from src.smith.schemas import GeneratedWorkflow, SmithMessage


DEFAULT_MODEL = "gemini/gemini-2.5-flash-lite"
DEFAULT_MAX_ITERS = 5


class SmithAgentService:
    """
    Thin service layer that keeps a warm Smith agent around for API calls.

    ReAct with tools needs live reasoning on each request, so we favor a warm
    cached agent over DSPy compile artifacts for user-dependent requests/chats.
    """

    _configured = False
    _agents: dict[int, SmithAgent] = {}

    def __init__(self):
        if not SmithAgentService._configured:
            self._configure_lm()
            SmithAgentService._configured = True

    def _configure_lm(self) -> None:
        """Configure DSPy once for the process."""
        load_dotenv()

        model_id = os.getenv("SMITH_MODEL", DEFAULT_MODEL)
        temperature = float(os.getenv("SMITH_TEMPERATURE", "0.3"))
        max_tokens = int(os.getenv("SMITH_MAX_TOKENS", "8192"))

        dspy.configure(
            lm=dspy.LM(model_id, temperature=temperature, max_tokens=max_tokens)
        )

    def _get_agent(self, max_iters: int | None) -> SmithAgent:
        """Reuse Smith agent instances keyed by iteration limit."""
        iters = max_iters or int(os.getenv("SMITH_MAX_ITERS", DEFAULT_MAX_ITERS))

        if iters not in SmithAgentService._agents:
            SmithAgentService._agents[iters] = SmithAgent(max_iters=iters)

        return SmithAgentService._agents[iters]

    def generate_workflow(
        self,
        prompt: str,
        history: Iterable[SmithMessage] | None = None,
        workflow: dict[str, Any] | None = None,
        include_trace: bool = False,
        max_iters: int | None = None,
    ) -> GeneratedWorkflow:
        """Run Smith against a prompt, optional history, and optional workflow context."""
        agent = self._get_agent(max_iters)
        history_str = self._format_history(history)
        prompt_with_context = self._attach_context(prompt, workflow)

        result = agent(request=prompt_with_context, history=history_str)

        workflow = self._parse_workflow(result.workflow)
        response = result.response.strip()
        trace = self._format_trace(result) if include_trace else None

        return GeneratedWorkflow(response=response, workflow=workflow, trace=trace)

    def _format_history(self, history: Iterable[SmithMessage] | None) -> str:
        if not history:
            return ""

        return "\n".join(f"{msg.role.title()}: {msg.content}" for msg in history)

    def _parse_workflow(
        self, workflow_json: str | dict[str, Any] | None
    ) -> dict[str, Any]:
        if workflow_json is None:
            raise ValueError("Smith did not return workflow JSON.")

        if isinstance(workflow_json, dict):
            return workflow_json

        if not isinstance(workflow_json, str):
            raise ValueError("Workflow output must be JSON text or object.")

        content = workflow_json.strip()
        if not content:
            raise ValueError("Smith returned empty workflow JSON.")

        # Handle ```json fenced blocks
        if content.startswith("```"):
            fenced = re.search(r"```(?:json)?\\s*(.*?)```", content, re.DOTALL)
            if fenced:
                content = fenced.group(1).strip()

        # Try direct parse
        parsed = self._try_json_parse(content)
        if parsed is not None:
            return parsed

        # Try to salvage first JSON object in the text
        match = re.search(r"\{[\\s\\S]*\}", content)
        if match:
            parsed = self._try_json_parse(match.group(0))
            if parsed is not None:
                return parsed

        raise ValueError(
            "Unable to parse Smith workflow output: expected JSON with nodes/edges."
        )

    def _try_json_parse(self, text: str) -> dict[str, Any] | None:
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return None

        if isinstance(parsed, dict):
            return parsed
        return None

    def _format_trace(self, result: dspy.Prediction) -> list[str]:
        if not hasattr(result, "trajectory") or not result.trajectory:
            return []

        trace = result.trajectory
        steps: list[str] = []
        step = 0
        while True:
            thought_key = f"thought_{step}"
            tool_key = f"tool_name_{step}"
            args_key = f"tool_args_{step}"
            obs_key = f"observation_{step}"

            if thought_key not in trace:
                break

            if thought_key in trace and trace[thought_key]:
                steps.append(f"Thought {step + 1}: {trace[thought_key]}")

            if tool_key in trace and trace[tool_key]:
                tool_name = trace[tool_key]
                tool_args = trace.get(args_key, {})
                steps.append(f"Action {step + 1}: {tool_name} {tool_args}")

            if obs_key in trace and trace[obs_key]:
                obs = trace[obs_key]
                steps.append(f"Observation {step + 1}: {obs}")

            step += 1

        return steps

    def _attach_context(self, prompt: str, workflow: dict[str, Any] | None) -> str:
        """Include the current workflow JSON so the agent can edit in place."""
        if not workflow:
            return prompt

        try:
            workflow_json = json.dumps(workflow)
        except TypeError as exc:
            raise ValueError(
                f"Workflow context must be JSON serializable: {exc}"
            ) from exc

        return (
            "You can edit the existing workflow below.\n"
            "Return the full updated workflow JSON.\n\n"
            f"Current workflow: {workflow_json}\n\nUser request: {prompt}"
        )
