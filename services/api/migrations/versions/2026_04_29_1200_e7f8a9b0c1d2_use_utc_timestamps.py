"""use utc-aware timestamps

Revision ID: e7f8a9b0c1d2
Revises: d1e2f3a4b5c6
Create Date: 2026-04-29 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

# Revision identifiers
revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, None] = "fb62ad1bffc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TIMESTAMP_COLUMNS = {
    "samlconfiguration": ("created_at", "updated_at"),
    "workflows": ("created_at", "updated_at"),
    "workflow_versions": ("created_at",),
    "workflow_users": ("created_at", "updated_at"),
    "workflow_templates": ("created_at", "updated_at"),
    "workflow_credentials": ("created_at", "updated_at"),
    "workflow_credential_links": ("created_at", "updated_at"),
    "credential_shares": ("created_at", "updated_at"),
    "users": ("created_at", "updated_at", "last_login_at"),
    "executions": ("created_at", "updated_at", "completed_at"),
    "scheduled_workflows": ("created_at", "updated_at", "next_run_at"),
}


def _alter_columns(timezone_aware: bool) -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    target_type = (
        "TIMESTAMP WITH TIME ZONE" if timezone_aware else "TIMESTAMP WITHOUT TIME ZONE"
    )
    using_suffix = "AT TIME ZONE 'UTC'"

    for table, columns in TIMESTAMP_COLUMNS.items():
        for column in columns:
            op.execute(
                f'ALTER TABLE "{table}" ALTER COLUMN "{column}" '
                f'TYPE {target_type} USING "{column}" {using_suffix}'
            )


def upgrade() -> None:
    _alter_columns(timezone_aware=True)


def downgrade() -> None:
    _alter_columns(timezone_aware=False)
