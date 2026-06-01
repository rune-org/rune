"""Base validation value types."""

from dataclasses import dataclass, field
from typing import Any


class ValidationError:
    """A single validation failure.

    A value object (collected into ``ValidationResult``), not an exception.

    Attributes:
        message: Human-readable error message
        field: The field that failed validation
        context: Additional context for the error
    """

    def __init__(
        self,
        message: str,
        field: str | None = None,
        context: dict[str, Any] | None = None,
    ):
        self.message = message
        self.field = field
        self.context = context or {}


@dataclass
class ValidationResult:
    """Result of a validation operation.

    Attributes:
        valid: Whether validation passed
        errors: List of validation errors (empty if valid)
    """

    valid: bool
    errors: list[ValidationError] = field(default_factory=list)
