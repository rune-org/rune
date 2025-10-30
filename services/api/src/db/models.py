from datetime import datetime
from enum import Enum
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, Enum as SQLAlchemyEnum
from sqlalchemy.dialects.postgresql import JSONB


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
    TOKEN = "token"
    CUSTOM = "custom"
    SMTP = "smtp"


class TimestampModel(SQLModel):
    """Base model with created_at and updated_at timestamps."""

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(
        default_factory=datetime.now,
        sa_column_kwargs={"onupdate": datetime.now},
    )


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
    hashed_password: str = Field(exclude=True)
    role: UserRole = Field(
        default=UserRole.USER,
        sa_column=Column(SQLAlchemyEnum(UserRole, name="user_role", native_enum=True)),
    )
    is_active: bool = Field(default=True)
    last_login_at: Optional[datetime] = None

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
