from typing import Literal, Optional

from pydantic import BaseModel


class WorkflowDetailDocs(BaseModel):
    docs: str


class GenerateWorkflowDocsRequest(BaseModel):
    target_audience: Literal["Technical Developer", "Executive Summary"] = (
        "Executive Summary"
    )
    custom_style: Optional[str] = None
