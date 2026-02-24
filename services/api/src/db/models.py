from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel


class UserRole(str, Enum):
    """User role enumeration."""

    USER = "user"
    ADMIN = "admin"


class WorkflowRole(str, Enum):
    """Workflow role enumeration."""

    VIEWER = "viewer"
    EDITOR = "editor"
    OWNER = "owner"


class CredentialType(str, Enum):
    """Credential type enumeration."""

    API_KEY = "api_key"
    OAUTH2 = "oauth2"
    BASIC_AUTH = "basic_auth"
    HEADER = "header"
    TOKEN = "token"
    CUSTOM = "custom"
    SMTP = "smtp"


class AuthProvider(str, Enum):
    """Authentication provider for a user account."""

    LOCAL = "local"  # Standard email + password login
    SAML = "saml"  # SAML 2.0 SSO — no password


class TimestampModel(SQLModel):
    """Base model with created_at and updated_at timestamps."""

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(
        default_factory=datetime.now,
        sa_column_kwargs={"onupdate": datetime.now},
    )


class SAMLConfiguration(TimestampModel, table=True):
    """One record per SAML IdP integration.

    Each organisation that brings their own IdP gets one row.
    The SP private key is stored encrypted using the application's
    ENCRYPTION_KEY (Fernet) so it is never exposed in plaintext.
    """

    __tablename__ = "samlconfiguration"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Display name shown in admin UI
    name: str = Field(description="Human-readable label, e.g. 'Okta' or 'Azure AD'")

    # IdP metadata values (copy from IdP metadata XML)
    idp_entity_id: str = Field(description="IdP Entity ID (Issuer)")
    idp_sso_url: str = Field(description="IdP SSO redirect-binding URL")
    idp_slo_url: Optional[str] = Field(
        default=None, description="IdP Single Logout URL (optional)"
    )
    idp_certificate: str = Field(
        description="IdP X.509 signing certificate, full PEM with headers"
    )

    # SP keypair — auto-generated on config creation
    sp_private_key_encrypted: str = Field(
        description="SP RSA private key, Fernet-encrypted",
        exclude=True,  # Never serialise to Pydantic outputs
    )
    sp_certificate: str = Field(
        description="SP X.509 certificate, full PEM with headers"
    )

    # Optional email-domain hint for auto-discovery (e.g. 'acme.com')
    domain_hint: Optional[str] = Field(
        default=None,
        description="Email domain that maps to this IdP, used for SSO discovery",
    )

    is_active: bool = Field(default=True)

    # Back-reference to users provisioned through this config
    users: list["User"] = Relationship(back_populates="saml_config")


class WorkflowCredentialLink(TimestampModel, table=True):
    __tablename__ = "workflow_credential_links"

    workflow_id: int = Field(
        foreign_key="workflows.id",
        primary_key=True,
        ondelete="CASCADE",
        description="Workflow using this credential",
    )
    credential_id: int = Field(
        foreign_key="workflow_credentials.id",
        primary_key=True,
        ondelete="CASCADE",
        description="Credential being used",
    )


class User(TimestampModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field()
    email: str = Field(unique=True)
    # Nullable: SAML-only users have no password.
    hashed_password: Optional[str] = Field(default=None, exclude=True)
    role: UserRole = Field(
        default=UserRole.USER,
        sa_column=Column(SQLAlchemyEnum(UserRole, name="user_role", native_enum=True)),
    )
    # Authentication provider — determines which login path is allowed.
    auth_provider: AuthProvider = Field(
        default=AuthProvider.LOCAL,
        sa_column=Column(
            SQLAlchemyEnum(AuthProvider, name="auth_provider", native_enum=True)
        ),
    )
    # SAML NameID (unique subject from the IdP) — only set for SAML users.
    saml_subject: Optional[str] = Field(default=None, index=True)
    # FK to the SAMLConfiguration that created/owns this user.
    saml_config_id: Optional[int] = Field(
        default=None, foreign_key="samlconfiguration.id"
    )
    is_active: bool = Field(default=True)
    last_login_at: Optional[datetime] = None
    must_change_password: bool = Field(
        default=False,
        description="Flag indicating user must change their password",
    )

    # Relationships
    saml_config: Optional["SAMLConfiguration"] = Relationship(back_populates="users")
    workflow_permissions: list["WorkflowUser"] = Relationship(
        back_populates="user",
        cascade_delete=True,
        sa_relationship_kwargs={"foreign_keys": "WorkflowUser.user_id"},
    )
    granted_workflows: list["WorkflowUser"] = Relationship(
        back_populates="granter",
        sa_relationship_kwargs={"foreign_keys": "WorkflowUser.granted_by"},
    )
    templates: list["WorkflowTemplate"] = Relationship(back_populates="creator")
    credentials: list["WorkflowCredential"] = Relationship(back_populates="creator")
    shared_credentials: list["CredentialShare"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"foreign_keys": "CredentialShare.user_id"},
    )
    credentials_shared_by_me: list["CredentialShare"] = Relationship(
        back_populates="sharer",
        sa_relationship_kwargs={"foreign_keys": "CredentialShare.shared_by"},
    )


class Workflow(TimestampModel, table=True):
    __tablename__ = "workflows"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field()
    description: str = Field(default="", description="Description of the workflow")

    workflow_data: dict = Field(
        default_factory=dict,
        sa_type=JSONB,
    )

    is_active: bool = Field(default=False)
    version: int = Field(default=1)

    workflow_users: list["WorkflowUser"] = Relationship(back_populates="workflow")
    credentials: list["WorkflowCredential"] = Relationship(
        back_populates="used_in_workflows",
        link_model=WorkflowCredentialLink,
    )


class WorkflowUser(TimestampModel, table=True):
    """Junction table for workflow access permissions."""

    __tablename__ = "workflow_users"

    workflow_id: int = Field(
        foreign_key="workflows.id",
        primary_key=True,
        ondelete="CASCADE",
    )
    user_id: int = Field(
        foreign_key="users.id",
        primary_key=True,
        ondelete="CASCADE",
    )
    role: WorkflowRole = Field(
        default=WorkflowRole.VIEWER,
        sa_column=Column(
            SQLAlchemyEnum(WorkflowRole, name="workflow_role", native_enum=True)
        ),
    )
    granted_by: Optional[int] = Field(
        default=None,
        foreign_key="users.id",
        ondelete="SET NULL",
    )

    # Relationships
    workflow: Workflow = Relationship(back_populates="workflow_users")

    user: User = Relationship(
        back_populates="workflow_permissions",
        sa_relationship_kwargs={"foreign_keys": "WorkflowUser.user_id"},
    )

    granter: User = Relationship(
        back_populates="granted_workflows",
        sa_relationship_kwargs={"foreign_keys": "WorkflowUser.granted_by"},
    )


class WorkflowTemplate(TimestampModel, table=True):
    """
    Templates are pre-made workflows that users can use as starting points.
    Each template is a standalone workflow configuration that can be instantiated.
    Templates are independent from user workflows and contain their own workflow data.
    """

    __tablename__ = "workflow_templates"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field()
    description: str = Field(default="", description="Description of the template")

    workflow_data: dict = Field(
        default_factory=dict,
        sa_type=JSONB,
        description="The workflow configuration/structure for this template",
    )

    category: str = Field(
        default="general",
        description="Template category (e.g., 'automation', 'data-processing')",
    )
    is_public: bool = Field(
        default=False, description="Whether this template is publicly available"
    )
    usage_count: int = Field(
        default=0, description="Number of times this template has been used"
    )

    created_by: Optional[int] = Field(
        default=None,
        foreign_key="users.id",
        ondelete="SET NULL",
        description="User who created this template",
    )

    # Relationships
    creator: Optional[User] = Relationship(back_populates="templates")


class CredentialShare(TimestampModel, table=True):
    """Tracks which users have access to which credentials."""

    __tablename__ = "credential_shares"

    credential_id: int = Field(
        foreign_key="workflow_credentials.id",
        primary_key=True,
        ondelete="CASCADE",
        description="Credential being shared",
    )
    user_id: int = Field(
        foreign_key="users.id",
        primary_key=True,
        ondelete="CASCADE",
        description="User who has access to this credential",
    )
    shared_by: Optional[int] = Field(
        default=None,
        foreign_key="users.id",
        ondelete="SET NULL",
        description="User who shared this credential",
    )

    # Relationships
    credential: "WorkflowCredential" = Relationship(back_populates="shares")
    user: User = Relationship(
        back_populates="shared_credentials",
        sa_relationship_kwargs={"foreign_keys": "CredentialShare.user_id"},
    )
    sharer: Optional[User] = Relationship(
        back_populates="credentials_shared_by_me",
        sa_relationship_kwargs={"foreign_keys": "CredentialShare.shared_by"},
    )


class WorkflowCredential(TimestampModel, table=True):
    __tablename__ = "workflow_credentials"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(description="Name/identifier for this credential")
    credential_type: CredentialType = Field(
        sa_column=Column(
            SQLAlchemyEnum(CredentialType, name="credential_type", native_enum=True)
        ),
        description="Type of credential (API key, OAuth2, etc.)",
    )
    credential_data: str = Field(
        description="Dynamic credential data (encrypted in production)",
    )
    created_by: Optional[int] = Field(
        default=None,
        foreign_key="users.id",
        ondelete="SET NULL",
        description="User who created this credential",
    )

    # Relationships
    creator: Optional[User] = Relationship(back_populates="credentials")
    used_in_workflows: list["Workflow"] = Relationship(
        back_populates="credentials",
        link_model=WorkflowCredentialLink,
    )
    shares: list["CredentialShare"] = Relationship(
        back_populates="credential",
        cascade_delete=True,
    )
