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
    HEADER = "header"
    TOKEN = "token"
    CUSTOM = "custom"
    SMTP = "smtp"


class TriggerType(str, Enum):
    """Workflow trigger type enumeration.

    Note: ALL workflows can be manually run via API/UI.
    This enum tracks both automatic and manual trigger types.
    """

    MANUAL = "manual"  # Manual-only workflow (no automatic triggers)
    SCHEDULED = "scheduled"  # Triggered by scheduler at intervals
    WEBHOOK = "webhook"  # Triggered by incoming webhook


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
    must_change_password: bool = Field(
        default=False,
        description="Flag indicating user must change their password",
    )

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

    version: int = Field(default=1)

    # Trigger type - defaults to MANUAL for workflows with no automatic triggers
    # ALL workflows can be manually run regardless of this field
    # This field indicates the trigger type: MANUAL, SCHEDULED, or WEBHOOK
    trigger_type: TriggerType = Field(
        default=TriggerType.MANUAL,
        sa_column=Column(
            SQLAlchemyEnum(TriggerType, name="trigger_type", native_enum=True)
        ),
        description="Trigger type (manual/scheduled/webhook). Defaults to MANUAL",
    )

    workflow_users: list["WorkflowUser"] = Relationship(back_populates="workflow")
    credentials: list["WorkflowCredential"] = Relationship(
        back_populates="used_in_workflows",
        link_model=WorkflowCredentialLink,
    )
    # One-to-one relationship with schedule (nullable - only exists for scheduled workflows)
    schedule: Optional["ScheduledWorkflow"] = Relationship(
        back_populates="workflow",
        sa_relationship_kwargs={
            "uselist": False,
            "lazy": "noload",
        },  # Don't load by default
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


class ScheduledWorkflow(TimestampModel, table=True):
    """
    Tracks scheduled workflow executions.
    Allows workflows to be triggered automatically at specified intervals.
    """

    __tablename__ = "scheduled_workflows"

    id: Optional[int] = Field(default=None, primary_key=True)
    workflow_id: int = Field(
        foreign_key="workflows.id",
        ondelete="CASCADE",
        description="The workflow to execute on schedule",
    )
    is_active: bool = Field(
        default=True,
        description="Whether this schedule is currently active",
    )
    interval_seconds: int = Field(
        gt=0,
        description="Interval in seconds between executions (e.g., 300 for 5 minutes, 3600 for 1 hour)",
    )
    start_at: datetime = Field(
        default_factory=datetime.now,
        description="When this schedule should start (first execution time)",
    )
    next_run_at: datetime = Field(
        description="When the next execution is scheduled",
        index=True,
    )
    last_run_at: Optional[datetime] = Field(
        default=None,
        description="When the last execution occurred",
    )

    # Relationships
    workflow: Workflow = Relationship(back_populates="schedule")
