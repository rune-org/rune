import json
import os
from typing import Any

from dotenv import load_dotenv
from litellm import acompletion

from src.core.config import get_settings
from src.scryb.serializer import WorkflowSerializer


class DocumentationGenerator:
    _prompt: str | None = None
    _model: str | None = None

    def __init__(self):
        if DocumentationGenerator._model is None:
            self._setup_llm()
        if DocumentationGenerator._prompt is None:
            self._load_prompt()

    def _setup_llm(self):
        load_dotenv()
        settings = get_settings()
        DocumentationGenerator._model = settings.scryb_model

    def _load_prompt(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        prompt_path = os.path.join(current_dir, "gemini-flash-lite.json")

        prompt = (
            "Generate workflow documentation in Markdown for the requested "
            "target audience. Return only the documentation report."
        )
        if os.path.exists(prompt_path):
            with open(prompt_path, encoding="utf-8") as prompt_file:
                saved_prompt = json.load(prompt_file)
            prompt = saved_prompt["predict"]["signature"]["instructions"]

        DocumentationGenerator._prompt = prompt

    async def generate(
        self, workflow_data: dict[str, Any], target_audience: str
    ) -> str:
        serializer = WorkflowSerializer(workflow_data)
        sir_workflow = serializer.serialize()
        serialized_data = sir_workflow.model_dump()

        model = DocumentationGenerator._model
        prompt = DocumentationGenerator._prompt
        if model is None or prompt is None:
            raise RuntimeError("Documentation generator was not initialized")

        response = await acompletion(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": prompt,
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "target_audience": target_audience,
                            "workflow_json": serialized_data,
                        },
                        default=str,
                    ),
                },
            ],
        )
        content = response.choices[0].message.content
        return content or ""
