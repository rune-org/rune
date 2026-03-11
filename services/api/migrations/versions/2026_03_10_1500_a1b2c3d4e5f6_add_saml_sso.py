"""add SAML SSO support

Revision ID: a1b2c3d4e5f6
Revises: ba3dde446818
Create Date: 2026-03-10 15:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# Revision identifiers
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "ba3dde446818"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "samlconfiguration",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("idp_entity_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("idp_sso_url", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("idp_slo_url", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column(
            "idp_certificate", sqlmodel.sql.sqltypes.AutoString(), nullable=False
        ),
        sa.Column(
            "sp_private_key_encrypted",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
        ),
        sa.Column("sp_certificate", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("domain_hint", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    auth_provider_enum = sa.Enum("LOCAL", "SAML", name="auth_provider")
    auth_provider_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "users",
        sa.Column(
            "auth_provider",
            sa.Enum("LOCAL", "SAML", name="auth_provider"),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column("saml_subject", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("saml_config_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_saml_config_id",
        "users",
        "samlconfiguration",
        ["saml_config_id"],
        ["id"],
    )
    op.create_index(
        op.f("ix_users_saml_subject"), "users", ["saml_subject"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_users_saml_subject"), table_name="users")
    op.drop_constraint("fk_users_saml_config_id", "users", type_="foreignkey")
    op.drop_column("users", "saml_config_id")
    op.drop_column("users", "saml_subject")
    op.drop_column("users", "auth_provider")
    op.drop_table("samlconfiguration")

    sa.Enum(name="auth_provider").drop(op.get_bind(), checkfirst=True)
