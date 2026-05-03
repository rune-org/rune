"""add_content_hash_to_workflow_version

Revision ID: 193e79e320cc
Revises: f1a2b3c4d5e6
Create Date: 2026-05-03 20:39:01.332677
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# Revision identifiers
revision: str = '193e79e320cc'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('workflow_versions', sa.Column('content_hash', sa.String(), nullable=True))
    op.create_index(op.f('ix_workflow_versions_content_hash'), 'workflow_versions', ['content_hash'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_workflow_versions_content_hash'), table_name='workflow_versions')
    op.drop_column('workflow_versions', 'content_hash')
