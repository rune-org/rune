from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, SystemMessage

from src.core.config import get_settings
from src.db.models import Workflow
from src.scryb.prompts import build_system_prompt, get_style_prompt
from src.scryb.schemas import GenerateWorkflowDocsRequest
from src.scryb.serializer import WorkflowSerializer
from src.workflow.service import WorkflowService


class ScrybService:
    def __init__(self, workflow_service: WorkflowService):
        self._workflow_service = workflow_service
        settings = get_settings()
        self._model = init_chat_model(
            settings.scryb_model,
            temperature=settings.scryb_temperature,
            model_provider="openrouter",
        )

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
        system_prompt = build_system_prompt(style_prompt)

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=str(serialized_data)),
        ]

        response = await self._model.ainvoke(messages)
        return response.content
