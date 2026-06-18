import json

from langchain_core.messages import BaseMessage, HumanMessage

from src.db.models import Workflow
from src.scryb.prompts import get_style_prompt
from src.scryb.schemas import GenerateWorkflowDocsRequest
from src.scryb.serializer import WorkflowSerializer
from src.workflow.service import WorkflowService


def _message_text(message: BaseMessage) -> str:
    """Return a message's text content as a plain string.

    Gemini may return ``content`` either as a string or as a list of content
    blocks (dicts with a ``text`` field, or bare strings). Join the text parts so
    the endpoint always returns clean Markdown.
    """
    content = message.content
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [
            block["text"] if isinstance(block, dict) else str(block)
            for block in content
            if not isinstance(block, dict) or "text" in block
        ]
        return "".join(parts)
    return str(content)


class ScrybService:
    def __init__(self, agent, workflow_service: WorkflowService):
        self._agent = agent
        self._workflow_service = workflow_service

    async def generate_docs(
        self,
        workflow: Workflow,
        request: GenerateWorkflowDocsRequest,
    ) -> str | None:
        workflow_data = await self._workflow_service.get_latest_workflow_data(workflow)
        if workflow_data is None:
            return None

        workflow_data["id"] = str(workflow.id)
        workflow_data["name"] = workflow.name
        workflow_data["description"] = workflow.description

        serializer = WorkflowSerializer(workflow_data)
        sir_workflow = serializer.serialize()
        serialized_data = sir_workflow.model_dump()

        style_prompt = (
            request.custom_style
            if request.custom_style
            else get_style_prompt(request.target_audience)
        )

        serialized_json = json.dumps(serialized_data, indent=2, ensure_ascii=False)

        human_content = (
            "Produce the documentation in the following style:\n\n"
            f"{style_prompt}\n\n"
            "## Workflow (SIR JSON)\n\n"
            f"{serialized_json}"
        )

        result = await self._agent.ainvoke(
            {"messages": [HumanMessage(content=human_content)]}
        )
        return _message_text(result["messages"][-1])
