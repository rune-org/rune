"""Add immutable workflow versions.

Revision ID: 20260306_0001
Revises:
Create Date: 2026-03-06 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260306_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workflow_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workflow_id", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column(
            "workflow_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("message", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["workflow_id"], ["workflows.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workflow_id",
            "version",
            name="uq_workflow_versions_workflow_id_version",
        ),
    )
    op.create_index(
        "ix_workflow_versions_workflow_id",
        "workflow_versions",
        ["workflow_id"],
        unique=False,
    )
    op.create_index(
        "ix_workflow_versions_created_at",
        "workflow_versions",
        ["created_at"],
        unique=False,
    )

    op.add_column(
        "workflows",
        sa.Column("latest_version_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "workflows",
        sa.Column("published_version_id", sa.Integer(), nullable=True),
    )
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

    op.execute(
        sa.text(
            """
            INSERT INTO workflow_versions (
                workflow_id,
                version,
                workflow_data,
                created_by,
                message,
                created_at
            )
            SELECT
                id,
                GREATEST(COALESCE(version, 1), 1),
                COALESCE(workflow_data, '{}'::jsonb),
                NULL,
                'Imported legacy workflow',
                COALESCE(updated_at, created_at, NOW())
            FROM workflows
            """
        )
    )

    op.execute(
        sa.text(
            """
            UPDATE workflows
            SET latest_version_id = workflow_versions.id
            FROM workflow_versions
            WHERE workflow_versions.workflow_id = workflows.id
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE workflows
            SET published_version_id = latest_version_id
            WHERE is_active = TRUE
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE workflows
            SET is_active = CASE
                WHEN published_version_id IS NOT NULL THEN TRUE
                ELSE FALSE
            END
            """
        )
    )

    op.drop_column("workflows", "workflow_data")
    op.drop_column("workflows", "version")


def downgrade() -> None:
    op.add_column(
        "workflows",
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )
    op.add_column(
        "workflows",
        sa.Column(
            "workflow_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.execute(
        sa.text(
            """
            UPDATE workflows
            SET
                workflow_data = COALESCE(workflow_versions.workflow_data, '{}'::jsonb),
                version = COALESCE(workflow_versions.version, 1)
            FROM workflow_versions
            WHERE workflow_versions.id = workflows.latest_version_id
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE workflows
            SET version = GREATEST(COALESCE(version, 1), 1)
            """
        )
    )

    op.alter_column("workflows", "workflow_data", server_default=None)
    op.alter_column("workflows", "version", server_default=None)

    op.drop_constraint(
        "fk_workflows_published_version_id",
        "workflows",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_workflows_latest_version_id",
        "workflows",
        type_="foreignkey",
    )
    op.drop_column("workflows", "published_version_id")
    op.drop_column("workflows", "latest_version_id")

    op.drop_index("ix_workflow_versions_created_at", table_name="workflow_versions")
    op.drop_index("ix_workflow_versions_workflow_id", table_name="workflow_versions")
    op.drop_table("workflow_versions")
