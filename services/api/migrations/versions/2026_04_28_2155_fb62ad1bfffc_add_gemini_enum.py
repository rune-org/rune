"""add gemini enum

Revision ID: fb62ad1bfffc
Revises: d1e2f3a4b5c6
Create Date: 2026-04-28 21:55:08.948928
"""
from typing import Sequence, Union

from alembic import op

# Revision identifiers
revision: str = 'fb62ad1bfffc'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE credential_type ADD VALUE IF NOT EXISTS 'GEMINI_API_KEY'")


def downgrade() -> None:
    # Postgres does not support removing values from an enum type.
    pass
