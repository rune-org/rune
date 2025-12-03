import dspy

from .tools import SMITH_TOOLS


class WorkflowSignature(dspy.Signature):
    """Convert natural language to a Rune workflow.

    Build workflows by:
    1. Creating nodes (trigger first, then http/smtp/if/etc)
    2. Connecting them with edges (src -> dst)
    3. Calling build_workflow to assemble

    Node schemas (fields/outputs):
    trigger: {}
    http: fields: method (GET|POST|PUT|DELETE, required), url (required), headers, body. outputs: status, body, headers
    smtp: fields: to (required), subject, body. outputs: sent
    if: fields: expression (required). outputs: true, false. Use label "true"/"false" on edges
    switch: fields: rules (array of {value, operator, compare}, all string). outputs: case 1, case 2, ..., fallback. Use labels "case 1"/"case 2"/... or "fallback" on edges.

    Reference previous node outputs with $NodeName.field (e.g., $Fetch.status).
    For conditional (if) nodes, use label="true" or "false" on edges.
    For switch nodes, use label="case 1", "case 2", etc. or "fallback" on edges.
    """

    request: str = dspy.InputField(desc="User's workflow request")
    history: str = dspy.InputField(desc="Conversation history", default="")

    response: str = dspy.OutputField(desc="Response to user")
    workflow: str = dspy.OutputField(desc="Workflow JSON or empty if clarification needed")


class SmithAgent(dspy.Module):
    """ReAct agent that builds workflows from natural language."""

    def __init__(self, max_iters: int = 5):
        super().__init__()
        self.react = dspy.ReAct(WorkflowSignature, tools=SMITH_TOOLS, max_iters=max_iters)

    def forward(self, request: str, history: str = "") -> dspy.Prediction:
        return self.react(request=request, history=history)


class SmithAgentWithMemory:
    """SmithAgent wrapper with conversation memory."""

    def __init__(self, max_iters: int = 5):
        self.agent = SmithAgent(max_iters=max_iters)
        self.history: list[tuple[str, str]] = []
        self.last_workflow: str | None = None
        self.last_result: dspy.Prediction | None = None

    def chat(self, message: str) -> dict:
        """Send message, get response."""
        history_str = "\n".join(f"{r}: {m}" for r, m in self.history)

        result = self.agent(request=message, history=history_str)
        self.last_result = result

        response = result.response
        workflow = result.workflow

        self.history.append(("User", message))
        self.history.append(("Smith", response))

        # Keep last 20 turns
        if len(self.history) > 40:
            self.history = self.history[-40:]

        if workflow and workflow.strip():
            self.last_workflow = workflow

        return {
            "response": response,
            "workflow": workflow if workflow and workflow.strip() else None,
        }

    def clear(self):
        """Clear history."""
        self.history = []
        self.last_workflow = None
        self.last_result = None
