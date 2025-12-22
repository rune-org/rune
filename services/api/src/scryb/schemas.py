from pydantic import BaseModel
from typing import Literal


class WorkflowDetailDocs(BaseModel):
    docs: str


class GenerateWorkflowDocsRequest(BaseModel):
    target_audience: Literal["Technical Developer", "Executive Summary"] = (
        "Executive Summary"
    )
