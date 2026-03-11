"""add workflow versions

Revision ID: c7d8e9f0a1b2
Revises: a1b2c3d4e5f6
Create Date: 2026-03-11 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

# Revision identifiers
revision: str = "c7d8e9f0a1b2"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create the workflow_versions table
    op.create_table(
        "workflow_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workflow_id", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column(
            "workflow_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column(
            "message", sqlmodel.sql.sqltypes.AutoString(), nullable=True
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["workflow_id"], ["workflows.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workflow_id",
            "version",
            name="uq_workflow_versions_workflow_id_version",
        ),
    )
    op.create_index(
        op.f("ix_workflow_versions_workflow_id"),
        "workflow_versions",
        ["workflow_id"],
        unique=False,
    )

    # 2. Migrate existing workflow data into version 1 rows.
    #    Use raw SQL so this works even when the ORM models have changed.
    op.execute(
        sa.text(
            """
            INSERT INTO workflow_versions (workflow_id, version, workflow_data, created_at)
            SELECT id, 1, workflow_data, created_at
            FROM workflows
            """
        )
    )

    # 3. Add the new FK columns to workflows
    op.add_column(
        "workflows",
        sa.Column("latest_version_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "workflows",
        sa.Column("published_version_id", sa.Integer(), nullable=True),
    )

    # 4. Point latest_version_id at the just-created v1 row for each workflow.
    #    For active workflows, also set published_version_id.
    op.execute(
        sa.text(
            """
            UPDATE workflows w
            SET latest_version_id = wv.id
            FROM workflow_versions wv
            WHERE wv.workflow_id = w.id AND wv.version = 1
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE workflows w
            SET published_version_id = wv.id
            FROM workflow_versions wv
            WHERE wv.workflow_id = w.id AND wv.version = 1
              AND w.is_active = true
            """
        )
    )

    # 5. Create FK constraints (use_alter to handle circular reference)
    op.create_foreign_key(
        "fk_workflows_latest_version_id",
        "workflows",
        "workflow_versions",
        ["latest_version_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_workflows_published_version_id",
        "workflows",
        "workflow_versions",
        ["published_version_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 6. Drop the old columns that are now superseded by workflow_versions
    op.drop_column("workflows", "workflow_data")
    op.drop_column("workflows", "version")


def downgrade() -> None:
    # 1. Re-add the old columns
    op.add_column(
        "workflows",
        sa.Column(
            "workflow_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
    )
    op.add_column(
        "workflows",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )

    # 2. Copy data back from latest version row
    op.execute(
        sa.text(
            """
            UPDATE workflows w
            SET workflow_data = COALESCE(wv.workflow_data, '{}'::jsonb),
                version = COALESCE(wv.version, 1)
            FROM workflow_versions wv
            WHERE wv.id = w.latest_version_id
            """
        )
    )

    # 3. Drop FK constraints and new columns
    op.drop_constraint(
        "fk_workflows_published_version_id", "workflows", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_workflows_latest_version_id", "workflows", type_="foreignkey"
    )
    op.drop_column("workflows", "published_version_id")
    op.drop_column("workflows", "latest_version_id")

    # 4. Remove server_default from restored columns
    op.alter_column("workflows", "workflow_data", server_default=None)
    op.alter_column("workflows", "version", server_default=None)

    # 5. Drop the versions table
    op.drop_index(
        op.f("ix_workflow_versions_workflow_id"), table_name="workflow_versions"
    )
    op.drop_table("workflow_versions")
