"""add content hash to workflow versions

Revision ID: 193e79e320cc
Revises: a1c2e3f4b5d6
Create Date: 2026-06-02 01:40:12.803490
"""

import hashlib
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Revision identifiers
revision: str = "193e79e320cc"
down_revision: Union[str, None] = "a1c2e3f4b5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _calculate_workflow_hash(workflow_data: object) -> str:
    if not workflow_data:
        return hashlib.sha256(b"{}").hexdigest()

    canonical_json = json.dumps(
        workflow_data, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")

    return hashlib.sha256(canonical_json).hexdigest()


def upgrade() -> None:
    op.add_column(
        "workflow_versions", sa.Column("content_hash", sa.String(), nullable=True)
    )

    bind = op.get_bind()
    workflow_versions = sa.table(
        "workflow_versions",
        sa.column("id", sa.Integer),
        sa.column("workflow_data", sa.JSON),
        sa.column("content_hash", sa.String),
    )
    rows = bind.execute(
        sa.select(workflow_versions.c.id, workflow_versions.c.workflow_data).where(
            workflow_versions.c.content_hash.is_(None)
        )
    )

    for row in rows:
        bind.execute(
            workflow_versions.update()
            .where(workflow_versions.c.id == row.id)
            .values(content_hash=_calculate_workflow_hash(row.workflow_data))
        )

    op.create_index(
        op.f("ix_workflow_versions_content_hash"),
        "workflow_versions",
        ["content_hash"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_workflow_versions_content_hash"), table_name="workflow_versions"
    )
    op.drop_column("workflow_versions", "content_hash")
