import os
import dspy
from typing import Any, Literal
from dotenv import load_dotenv
from src.scryb.serializer import WorkflowSerializer


class WorkflowDocumentation(dspy.Signature):
    """
    Generates documentation for the workflow based on its JSON definition
    and a specific target audience.
    """

    workflow_json: dict[str, Any] = dspy.InputField(
        desc="The raw JSON domain-specific language of the workflow."
    )
    target_audience: Literal["Technical Developer", "Executive Summary"] = (
        dspy.InputField(desc="The persona to write for.")
    )

    report = dspy.OutputField(
        desc="The generated documentation report in Markdown format."
    )


class DocumentationGenerator:
    _bot = None

    def __init__(self):
        if DocumentationGenerator._bot is None:
            self._setup_dspy()
            self._load_prompt()

    def _setup_dspy(self):
        load_dotenv()
        # Use Google AI Studio (Gemini)
        # Expects GOOGLE_API_KEY in environment variables
        lm = dspy.LM(
            "gemini/gemini-2.5-flash-lite",
        )
        dspy.configure(lm=lm)

    def _load_prompt(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        prompt_path = os.path.join(current_dir, "gemini-flash-lite.json")

        bot = dspy.ChainOfThought(WorkflowDocumentation)
        if os.path.exists(prompt_path):
            bot.load(prompt_path)

        DocumentationGenerator._bot = bot

    async def generate(
        self, workflow_data: dict[str, Any], target_audience: str
    ) -> str:
        serializer = WorkflowSerializer(workflow_data)
        sir_workflow = serializer.serialize()
        serialized_data = sir_workflow.model_dump()

        prediction = await DocumentationGenerator._bot.acall(
            workflow_json=serialized_data, target_audience=target_audience
        )
        return prediction.report
