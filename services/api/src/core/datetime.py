from datetime import datetime, timezone
from typing import Any

from sqlalchemy.types import DateTime, TypeDecorator


def utc_now() -> datetime:
    """Return the current time as a timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def ensure_utc(value: datetime | None) -> datetime | None:
    """Normalize datetimes to UTC, treating legacy naive values as UTC."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Store datetimes in UTC and always return timezone-aware values."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(
        self, value: datetime | None, dialect: Any
    ) -> datetime | None:
        return ensure_utc(value)

    def process_result_value(
        self, value: datetime | None, dialect: Any
    ) -> datetime | None:
        return ensure_utc(value)
