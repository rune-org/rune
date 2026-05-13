"""Workflow validation package.

Modular validation system for workflow data.
Organized into:
- base: Base classes and interfaces
- edge: Edge/wiring validation
- node: Node ID validation
- workflow: Combined workflow validation
"""

from src.workflow.validation.base import (
    ValidationError,
    ValidationResult,
    Validator,
)
from src.workflow.validation.edge import EdgeWiringValidator
from src.workflow.validation.node import NodeIdValidator
from src.workflow.validation.workflow import (
    WorkflowStructureValidator,
    WorkflowValidator,
    validate_workflow_data,
    validate_workflow_structure,
    validate_workflow_wiring,
)

__all__ = [
    "ValidationError",
    "ValidationResult",
    "Validator",
    "EdgeWiringValidator",
    "NodeIdValidator",
    "WorkflowStructureValidator",
    "WorkflowValidator",
    "validate_workflow_data",
    "validate_workflow_structure",
    "validate_workflow_wiring",
]
