"""
Pydantic schemas for CLI database endpoints.

These are read-only introspection models and a safe truncate response.
No raw SQL schemas — the CLI does not support arbitrary SQL execution.
"""

from pydantic import BaseModel, Field


class DBHealthResponse(BaseModel):
    """Database health check result."""

    connected: bool = Field(description="Whether the database is reachable")
    version: str = Field(default="", description="PostgreSQL version string")
    database_name: str = Field(default="", description="Current database name")
    database_size: str = Field(default="", description="Human-readable database size")
    table_count: int = Field(default=0, description="Number of tables")
    user_count: int = Field(
        default=-1, description="Number of users (-1 if unavailable)"
    )
    workflow_count: int = Field(
        default=-1, description="Number of workflows (-1 if unavailable)"
    )
    latency_ms: float = Field(
        default=0.0, description="Query latency in milliseconds"
    )


class DBTableInfo(BaseModel):
    """Information about a single database table."""

    name: str = Field(description="Table name")
    row_count: int = Field(default=0, description="Estimated row count")
    size_bytes: int = Field(default=0, description="Table size in bytes")
    size_human: str = Field(default="0 bytes", description="Human-readable size")


class DBTableData(BaseModel):
    """Data rows from a database table (read-only)."""

    table_name: str = Field(description="Table that was queried")
    columns: list[str] = Field(default_factory=list, description="Column names")
    rows: list[list[str]] = Field(
        default_factory=list, description="Row data as strings"
    )
    row_count: int = Field(default=0, description="Total row count in the table")
