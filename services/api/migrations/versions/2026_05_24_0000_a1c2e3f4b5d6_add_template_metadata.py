"""add template metadata columns

Adds curation metadata (source, external_id, icon, tags, author info) to
``workflow_templates`` so the table can hold both user-saved templates and
official ones seeded from the ``rune-templates`` repo bundle.

Revision ID: a1c2e3f4b5d6
Revises: fb62ad1bfffc
Create Date: 2026-05-24 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

# Revision identifiers
revision: str = "a1c2e3f4b5d6"
down_revision: Union[str, None] = "fb62ad1bfffc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # source: backfill existing rows as 'user' before enforcing NOT NULL.
    op.add_column(
        "workflow_templates",
        sa.Column(
            "source",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=True,
            server_default="user",
        ),
    )
    op.execute(
        "UPDATE workflow_templates SET source = 'user' WHERE source IS NULL"
    )
    op.alter_column("workflow_templates", "source", nullable=False)

    op.add_column(
        "workflow_templates",
        sa.Column(
            "external_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True
        ),
    )
    op.create_index(
        op.f("ix_workflow_templates_external_id"),
        "workflow_templates",
        ["external_id"],
        unique=True,
    )

    op.add_column(
        "workflow_templates",
        sa.Column("icon", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    )

    # tags: JSONB array, default empty list. Backfill existing rows.
    op.add_column(
        "workflow_templates",
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.execute(
        "UPDATE workflow_templates SET tags = '[]'::jsonb WHERE tags IS NULL"
    )
    op.alter_column("workflow_templates", "tags", nullable=False)

    op.add_column(
        "workflow_templates",
        sa.Column(
            "author_name", sqlmodel.sql.sqltypes.AutoString(), nullable=True
        ),
    )
    op.add_column(
        "workflow_templates",
        sa.Column(
            "author_url", sqlmodel.sql.sqltypes.AutoString(), nullable=True
        ),
    )

    # Composite index for the most common list query: filter by source + category.
    op.create_index(
        "ix_workflow_templates_source_category",
        "workflow_templates",
        ["source", "category"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_workflow_templates_source_category", table_name="workflow_templates"
    )
    op.drop_column("workflow_templates", "author_url")
    op.drop_column("workflow_templates", "author_name")
    op.drop_column("workflow_templates", "tags")
    op.drop_column("workflow_templates", "icon")
    op.drop_index(
        op.f("ix_workflow_templates_external_id"), table_name="workflow_templates"
    )
    op.drop_column("workflow_templates", "external_id")
    op.drop_column("workflow_templates", "source")
