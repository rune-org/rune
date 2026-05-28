from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from src.templates.categories import TemplateCategory, derive_scope


class WorkflowNodePosition(BaseModel):
    """X/Y position for a workflow node on the canvas."""

    x: float
    y: float

    model_config = ConfigDict(extra="allow")


class WorkflowNode(BaseModel):
    """A single node in a workflow graph (React Flow shape).

    Per-node ``data`` is intentionally loose (``dict[str, Any]``): different
    node types have different config shapes, and templates need to keep working
    as the connector catalog evolves. Only the structural identity fields
    (``id``, ``type``) are strictly required.
    """

    id: str = Field(..., min_length=1)
    type: str = Field(..., min_length=1)
    position: Optional[WorkflowNodePosition] = None
    data: dict[str, Any] = Field(default_factory=dict)
    trigger: Optional[bool] = None

    model_config = ConfigDict(extra="allow")


class WorkflowEdge(BaseModel):
    """A single edge in a workflow graph (React Flow shape).

    Edges use ``source``/``target`` (React Flow convention) - this is the
    canvas-facing shape that templates ship in. The runtime worker uses
    ``src``/``dst`` but conversion happens client-side in ``workflow-dsl.ts``
    when a workflow is saved.
    """

    id: str = Field(..., min_length=1)
    source: str = Field(..., min_length=1)
    target: str = Field(..., min_length=1)
    type: Optional[str] = None
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None
    label: Optional[str] = None

    model_config = ConfigDict(extra="allow")


class WorkflowGraph(BaseModel):
    """A workflow graph: nodes + edges (+ optional metadata).

    Structure is strict (the top-level shape and per-element required fields
    are validated). Empty ``nodes``/``edges`` arrays are allowed at the
    template-storage layer - runtime ``queue.py`` enforces "must have a
    trigger" only when a workflow is actually queued for execution.
    """

    nodes: list[WorkflowNode] = Field(default_factory=list)
    edges: list[WorkflowEdge] = Field(default_factory=list)
    metadata: Optional[dict[str, Any]] = None

    model_config = ConfigDict(extra="allow")

    @field_validator("nodes")
    @classmethod
    def validate_node_ids_unique(cls, v: list[WorkflowNode]) -> list[WorkflowNode]:
        ids = [n.id for n in v]
        if len(ids) != len(set(ids)):
            raise ValueError("Workflow node ids must be unique")
        return v

    @field_validator("edges")
    @classmethod
    def validate_edge_ids_unique(cls, v: list[WorkflowEdge]) -> list[WorkflowEdge]:
        ids = [e.id for e in v]
        if len(ids) != len(set(ids)):
            raise ValueError("Workflow edge ids must be unique")
        return v


class TemplateSummary(BaseModel):
    """Template summary for listing templates.

    ``category`` is typed as ``str`` (not ``TemplateCategory``) so legacy
    values stored in the DB (``automation``, ``data-processing``, ...) still
    round-trip on read.
    """

    id: int
    name: str
    description: str
    category: str
    usage_count: int
    is_public: bool
    source: str = "user"
    external_id: Optional[str] = None
    icon: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    author_name: Optional[str] = None
    author_url: Optional[str] = None
    node_count: int = 0

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def scope(self) -> str:
        """User-facing bucket: official / community / personal."""
        return derive_scope(self.source, self.is_public).value


class TemplateDetail(BaseModel):
    """Detailed template information including workflow data.

    ``workflow_data`` is typed as ``dict[str, Any]`` rather than
    ``WorkflowGraph`` so existing templates with legacy or partial shapes
    continue to round-trip on read. New templates are validated against
    ``WorkflowGraph`` on write via ``TemplateCreate``.
    """

    id: int
    name: str
    description: str
    category: str
    workflow_data: dict[str, Any]
    usage_count: int
    is_public: bool
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int]
    source: str = "user"
    external_id: Optional[str] = None
    icon: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    author_name: Optional[str] = None
    author_url: Optional[str] = None

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def scope(self) -> str:
        """User-facing bucket: official / community / personal."""
        return derive_scope(self.source, self.is_public).value


class TemplateCreate(BaseModel):
    """Schema for creating a new template.

    User-saved templates only; official templates are inserted by the bundle
    seeder, which uses the DB model directly.
    """

    name: str = Field(..., min_length=1)
    description: str = Field(default="")
    category: TemplateCategory = Field(default=TemplateCategory.GENERAL)
    workflow_data: WorkflowGraph = Field(...)
    is_public: bool = Field(default=False)
    icon: Optional[str] = None
    tags: list[str] = Field(default_factory=list)

    model_config = ConfigDict(str_to_lower=False, use_enum_values=True)

    @field_validator("is_public", mode="before")
    @classmethod
    def validate_is_public_strict(cls, v: Any) -> bool:
        """Validate that is_public is strictly a boolean, not a string."""
        if not isinstance(v, bool):
            raise ValueError(f"is_public must be a boolean, got {type(v).__name__}")
        return v

    @field_validator("workflow_data", mode="before")
    @classmethod
    def reject_empty_workflow_data(cls, v: Any) -> Any:
        """Reject ``workflow_data: {}``.

        Structural validation of nodes/edges is delegated to ``WorkflowGraph``;
        this preserves the historical behaviour of rejecting a fully-empty
        payload at the API boundary so callers fail loudly instead of saving a
        placeholder template by accident.
        """
        if isinstance(v, dict) and not v:
            raise ValueError("workflow_data cannot be empty")
        return v


class TemplateWorkflowData(BaseModel):
    """Schema for template workflow data response."""

    workflow_data: dict[str, Any]


class TemplateAuthor(BaseModel):
    """Author block embedded in a bundled template JSON file."""

    name: str = Field(..., min_length=1)
    url: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class TemplateCategorySummary(BaseModel):
    """One row in the ``GET /templates/categories`` response."""

    value: str
    label: str
    count: int


class TemplateBundleEntry(BaseModel):
    """Shape of a single ``.json`` file in the ``rune-templates`` bundle.

    This is the contributor-facing schema - the exported JSON Schema is
    generated from this model and committed into ``rune-templates`` for CI
    validation. The seeder also parses each bundle file with this model so
    invalid templates never reach the database.
    """

    external_id: str = Field(
        ...,
        min_length=1,
        pattern=r"^[a-z0-9][a-z0-9-]*$",
        description="Stable slug used as the upsert key. Lowercase, hyphen-separated.",
    )
    name: str = Field(..., min_length=1)
    description: str = Field(default="")
    category: TemplateCategory
    icon: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    author: Optional[TemplateAuthor] = None
    official: bool = Field(
        default=False,
        description=(
            "Marks the template as a Rune-curated official entry. Contributor "
            "PRs leave this as false; PR review is the gate that prevents "
            "outside contributions from claiming official status."
        ),
    )
    workflow_data: WorkflowGraph

    model_config = ConfigDict(extra="forbid", use_enum_values=True)
