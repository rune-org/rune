from typing import Literal

from pydantic import BaseModel


class WorkflowDetailDocs(BaseModel):
    docs: str


class GenerateWorkflowDocsRequest(BaseModel):
    target_audience: Literal["Technical Developer", "Executive Summary"] = (
        "Executive Summary"
    )
