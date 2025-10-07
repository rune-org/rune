from datetime import datetime, timezone
from typing import Optional, List
import os
from zoneinfo import ZoneInfo
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON, func, Integer, DateTime
from sqlalchemy.dialects.postgresql import JSONB


# IANA timezone name (e.g. 'UTC', 'Africa/Cairo') to change behavior.
_APP_TZ = os.getenv("APP_TIMEZONE", "UTC")
try:
    _ZONE = ZoneInfo(_APP_TZ)
except Exception:
    # Fallback to UTC if zone not found
    _ZONE = timezone.utc


def now() -> datetime:
    """Return timezone-aware datetime using configured APP_TIMEZONE."""
    return datetime.now(_ZONE)


class User(SQLModel, table=True):
    __tablename__ = "users"
    
    id: Optional[int] = Field(default=None, primary_key=True, sa_column=Column(Integer, autoincrement=True))
    name: str
    email: str = Field(unique=True, index=True)
    password_hash: str
    role: str = Field(default="user")  # 'user', 'admin'
    is_active: bool = Field(default=True)
    
    # Timestamps
    created_at: datetime = Field(default_factory=now)
    updated_at: datetime = Field(default_factory=now)
    last_login_at: datetime = Field(default_factory=now)
    
    # Relationships
    # Workflows created by this user - SET NULL on user deletion to preserve workflows
    workflows: List["Workflow"] = Relationship(
        back_populates="creator",
        sa_relationship_kwargs={
            "foreign_keys": "[Workflow.created_by]",
            "cascade": "all, delete-orphan"  # Delete workflows when user is deleted
        }
    )
    
    # Workflow access permissions granted TO this user
    workflow_permissions: List["WorkflowUser"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={
            "foreign_keys": "[WorkflowUser.user_id]",
            "cascade": "all, delete-orphan"  # Remove permissions when user is deleted
        }
    )
    
    # Permissions this user has GRANTED to others
    granted_permissions: List["WorkflowUser"] = Relationship(
        back_populates="granter",
        sa_relationship_kwargs={
            "foreign_keys": "[WorkflowUser.granted_by]",
            "cascade": "all, delete-orphan"  # Remove granted permissions when user is deleted
        }
    )
    
    # Templates created by this user
    workflow_templates: List["WorkflowTemplate"] = Relationship(
        back_populates="creator",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}  # Delete templates when user is deleted
    )


class Workflow(SQLModel, table=True):
    __tablename__ = "workflows"
    
    id: Optional[int] = Field(default=None, primary_key=True, sa_column=Column(Integer, autoincrement=True))
    name: str
    description: str = Field(default="")
    
    # JSONB workflow data
    workflow_data: dict = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False)
    )
    
    is_active: bool = Field(default=True)
    version: int = Field(default=1)
    created_by: int = Field(foreign_key="users.id", nullable=False)
    
    # Timestamps
    created_at: datetime = Field(default_factory=now)
    updated_at: datetime = Field(default_factory=now)
    
    # Relationships
    # Link back to the creator
    creator: Optional[User] = Relationship(
        back_populates="workflows",
        sa_relationship_kwargs={"foreign_keys": "[Workflow.created_by]"}
    )
    
    # Executions of this workflow - delete all when workflow is deleted
    executions: List["WorkflowExecution"] = Relationship(
        back_populates="workflow",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    
    # User permissions for this workflow - delete all when workflow is deleted
    workflow_users: List["WorkflowUser"] = Relationship(
        back_populates="workflow",
        sa_relationship_kwargs={
            "foreign_keys": "[WorkflowUser.workflow_id]",
            "cascade": "all, delete-orphan"
        }
    )

# ! IMPORTANT: This workflow execution model is not final and will be Changed later to elastic search for better performance and scalability.
class WorkflowExecution(SQLModel, table=True):
    __tablename__ = "workflow_executions"
    
    id: Optional[int] = Field(default=None, primary_key=True, sa_column=Column(Integer, autoincrement=True))
    workflow_id: int = Field(foreign_key="workflows.id")
    status: str = Field(default="pending")  # 'pending', 'running', 'completed', 'failed'
    
    # JSONB fields
    status_object: dict = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False)
    )
    metadata: dict = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False)
    )
    
    execution_time_ms: int = Field(default=0)
    trigger_source: str = Field(default="manual")  # 'manual', 'scheduled', 'webhook'
    
    # Timestamps
    started_at: datetime = Field(default_factory=now)
    # finished_at is nullable because execution may still be running. Store
    finished_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))

    # Relationships
    workflow: Optional[Workflow] = Relationship(back_populates="executions")


class WorkflowUser(SQLModel, table=True):
    __tablename__ = "workflow_users"
    
    id: Optional[int] = Field(default=None, primary_key=True, sa_column=Column(Integer, autoincrement=True))
    workflow_id: int = Field(foreign_key="workflows.id", nullable=False)
    user_id: int = Field(foreign_key="users.id", nullable=False)
    role: str = Field(default="viewer")  # 'viewer', 'editor', 'owner'
    granted_by: int = Field(foreign_key="users.id", nullable=False)
    
    # Timestamps
    created_at: datetime = Field(default_factory=now)
    updated_at: datetime = Field(default_factory=now)
    
    # Relationships
    # Link to the workflow this permission is for
    workflow: Optional[Workflow] = Relationship(
        back_populates="workflow_users",
        sa_relationship_kwargs={"foreign_keys": "[WorkflowUser.workflow_id]"}
    )
    
    # Link to the user who has this permission
    user: Optional[User] = Relationship(
        back_populates="workflow_permissions",
        sa_relationship_kwargs={"foreign_keys": "[WorkflowUser.user_id]"}
    )
    
    # Link to the user who granted this permission
    granter: Optional[User] = Relationship(
        back_populates="granted_permissions",
        sa_relationship_kwargs={"foreign_keys": "[WorkflowUser.granted_by]"}
    )


# ! IMPORTANT: WorkflowTemplate is not final and may change significantly after the MVP, based on the Rune team's vision.
class WorkflowTemplate(SQLModel, table=True):
    __tablename__ = "workflow_templates"
    
    id: Optional[int] = Field(default=None, primary_key=True, sa_column=Column(Integer, autoincrement=True))
    name: str
    description: str = Field(default="")
    category: str = Field(default="general")
    
    # JSONB field
    template_data: dict = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False)
    )
    
    is_public: bool = Field(default=False)
    usage_count: int = Field(default=0)
    created_by: int = Field(foreign_key="users.id", nullable=False)
    
    # Timestamps
    created_at: datetime = Field(default_factory=now)
    updated_at: datetime = Field(default_factory=now)
    
    # Relationships
    # Link to the user who created this template
    creator: Optional[User] = Relationship(back_populates="workflow_templates")

