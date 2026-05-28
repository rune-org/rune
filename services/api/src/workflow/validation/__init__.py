"""Workflow validation package.

Semantic validation for workflow data. Shape validation lives in the
``RuntimeWorkflowGraph`` Pydantic model (``src/workflow/schemas.py``); this
package only checks cross-field rules: edge endpoints reference existing nodes,
no self-references, and exactly one trigger node.
"""

from src.workflow.validation.base import ValidationError, ValidationResult
from src.workflow.validation.workflow import validate_workflow_data

__all__ = [
    "ValidationError",
    "ValidationResult",
    "validate_workflow_data",
]
