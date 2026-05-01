from datetime import datetime, timedelta, timezone

from src.core.datetime import ensure_utc, utc_now
from src.db.models import Execution, User


def test_utc_now_returns_aware_utc_datetime():
    now = utc_now()

    assert now.tzinfo is timezone.utc
    assert now.utcoffset() == timedelta(0)


def test_ensure_utc_treats_naive_legacy_values_as_utc():
    value = datetime(2026, 3, 10, 12, 30, 0)

    normalized = ensure_utc(value)

    assert normalized == datetime(2026, 3, 10, 12, 30, 0, tzinfo=timezone.utc)


def test_ensure_utc_converts_offsets_to_utc():
    value = datetime(2026, 3, 10, 14, 30, 0, tzinfo=timezone(timedelta(hours=2)))

    normalized = ensure_utc(value)

    assert normalized == datetime(2026, 3, 10, 12, 30, 0, tzinfo=timezone.utc)


def test_model_timestamp_defaults_are_utc_aware():
    user = User(name="Test User", email="test@example.com", hashed_password="hash")
    execution = Execution(id="exec-1", workflow_id=1)

    assert user.created_at.tzinfo is timezone.utc
    assert user.updated_at.tzinfo is timezone.utc
    assert execution.created_at.tzinfo is timezone.utc
    assert execution.updated_at.tzinfo is timezone.utc
