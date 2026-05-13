"""Base validation classes and interfaces."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


class ValidationError(Exception):
    """Base exception for workflow validation errors.

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
        super().__init__(message)
        self.message = message
        self.field = field
        self.context = context or {}

    def to_dict(self) -> dict[str, Any]:
        """Convert error to dictionary representation."""
        return {
            "message": self.message,
            "field": self.field,
            "context": self.context,
        }


@dataclass
class ValidationResult:
    """Result of a validation operation.

    Attributes:
        valid: Whether validation passed
        errors: List of validation errors (empty if valid)
    """

    valid: bool
    errors: list[ValidationError] = field(default_factory=list)

    @classmethod
    def success(cls) -> "ValidationResult":
        """Create a successful validation result."""
        return cls(valid=True, errors=[])

    @classmethod
    def failure(cls, errors: list[ValidationError]) -> "ValidationResult":
        """Create a failed validation result."""
        return cls(valid=False, errors=errors)

    @classmethod
    def failure_from_single(cls, error: ValidationError) -> "ValidationResult":
        """Create a failed validation result from a single error."""
        return cls(valid=False, errors=[error])

    def to_error_messages(self) -> list[str]:
        """Get list of error messages."""
        return [e.message for e in self.errors]


class Validator(ABC):
    """Abstract base class for validators.

    Subclasses must implement the validate method.
    """

    @abstractmethod
    def validate(self, data: Any) -> ValidationResult:
        """Validate the given data.

        Args:
            data: Data to validate

        Returns:
            ValidationResult indicating success or failure
        """
        pass

    def __call__(self, data: Any) -> ValidationResult:
        """Allow validators to be called as functions."""
        return self.validate(data)


class CompositeValidator(Validator):
    """Validator that combines multiple validators.

    Runs all validators and collects errors.
    """

    def __init__(self, validators: list[Validator]):
        self.validators = validators

    def validate(self, data: Any) -> ValidationResult:
        """Run all validators and collect results."""
        all_errors: list[ValidationError] = []

        for validator in self.validators:
            result = validator.validate(data)
            all_errors.extend(result.errors)

        if all_errors:
            return ValidationResult.failure(all_errors)
        return ValidationResult.success()
